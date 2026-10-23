// Hearthtable Launcher: a small window that runs local development (`node scripts/start.mjs`:
// emulators, `pnpm seed --refresh`, web app) with a log and Start/Stop buttons.
//
// Stopping sends Ctrl+C to the console the child processes share, so the emulators save their
// data before exiting, exactly as Ctrl+C in a terminal would. Closing the window with its X
// button stops the same way first and closes once everything has exited. If the launcher itself
// is killed, a Windows job object ends the child processes so none are left holding ports
// (that path cannot save emulator data).
//
// Options: --autostart starts at once; --test-cycle starts, stops once the app is up, and exits
// (used to check the launcher).
//
// Command line control, for the user and for agents, talking to the open launcher window:
//   "Hearthtable Launcher.exe" start    starts everything (opens the launcher first if needed)
//   "Hearthtable Launcher.exe" stop     stops and waits until the emulators have saved
//   "Hearthtable Launcher.exe" status   Running, Stopping or Stopped
//   "Hearthtable Launcher.exe" log 40   the last 40 log lines
// Opening the exe again while it is open just brings the window forward.
//
// Built with the C# 5 compiler that ships with Windows (.NET Framework 4); see build.bat.

using System;
using System.Diagnostics;
using System.IO.Pipes;
using System.Threading;
using System.Drawing;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

static class Native
{
    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AttachConsole(uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool FreeConsole();

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool SetConsoleCtrlHandler(IntPtr handler, bool add);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool GenerateConsoleCtrlEvent(uint ctrlEvent, uint processGroupId);

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr CreateJobObject(IntPtr attributes, string name);

    [DllImport("kernel32.dll")]
    public static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    [StructLayout(LayoutKind.Sequential)]
    public struct BasicLimit
    {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct IoCounters
    {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct ExtendedLimit
    {
        public BasicLimit BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("userenv.dll", SetLastError = true)]
    static extern bool CreateEnvironmentBlock(out IntPtr block, IntPtr token, bool inherit);

    [DllImport("userenv.dll", SetLastError = true)]
    static extern bool DestroyEnvironmentBlock(IntPtr block);

    /** The user's normal Windows environment, as a fresh sign-in would have it; null if unavailable. */
    public static System.Collections.Generic.Dictionary<string, string> UserEnvironment()
    {
        IntPtr block;
        IntPtr token = System.Security.Principal.WindowsIdentity.GetCurrent().Token;
        if (!CreateEnvironmentBlock(out block, token, false)) return null;
        try
        {
            System.Collections.Generic.Dictionary<string, string> env =
                new System.Collections.Generic.Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            IntPtr p = block;
            while (true)
            {
                string entry = Marshal.PtrToStringUni(p);
                if (string.IsNullOrEmpty(entry)) break;
                int eq = entry.IndexOf('=', 1);
                if (eq > 0) env[entry.Substring(0, eq)] = entry.Substring(eq + 1);
                p = new IntPtr(p.ToInt64() + (entry.Length + 1) * 2);
            }
            return env;
        }
        finally
        {
            DestroyEnvironmentBlock(block);
        }
    }

    /** A job whose processes all end when the launcher's handle to it closes. */
    public static IntPtr KillOnCloseJob()
    {
        IntPtr job = CreateJobObject(IntPtr.Zero, null);
        ExtendedLimit info = new ExtendedLimit();
        info.BasicLimitInformation.LimitFlags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        int size = Marshal.SizeOf(typeof(ExtendedLimit));
        IntPtr ptr = Marshal.AllocHGlobal(size);
        try
        {
            Marshal.StructureToPtr(info, ptr, false);
            SetInformationJobObject(job, 9, ptr, (uint)size); // JobObjectExtendedLimitInformation
        }
        finally
        {
            Marshal.FreeHGlobal(ptr);
        }
        return job;
    }
}

class LauncherForm : Form
{
    static readonly Regex Ansi = new Regex(@"\x1B\[[0-9;?]*[A-Za-z]");
    const string WebUrl = "http://localhost:5173/";

    readonly string root;
    readonly bool testCycle;
    readonly RichTextBox log = new RichTextBox();
    readonly Button startButton = new Button();
    readonly Button stopButton = new Button();
    readonly Button browserButton = new Button();
    readonly Button forceButton = new Button();
    readonly Label status = new Label();
    readonly System.Windows.Forms.Timer stopTimer = new System.Windows.Forms.Timer();
    readonly IntPtr job = Native.KillOnCloseJob();
    StreamWriter logFile;
    Process child;
    bool closeWhenStopped;
    bool stopping;
    int stopSeconds;

    public LauncherForm(string root, bool testCycle, bool autostart)
    {
        this.root = root;
        this.testCycle = testCycle;
        Text = "Hearthtable Launcher";
        Width = 1000;
        Height = 650;
        BackColor = Color.FromArgb(28, 22, 18);
        ForeColor = Color.FromArgb(232, 220, 200);
        Font = new Font("Segoe UI", 9.5f);

        FlowLayoutPanel bar = new FlowLayoutPanel();
        bar.Dock = DockStyle.Top;
        bar.Height = 44;
        bar.Padding = new Padding(6);
        foreach (Button b in new[] { startButton, stopButton, browserButton, forceButton })
        {
            b.Height = 30;
            b.AutoSize = true;
            b.FlatStyle = FlatStyle.Flat;
            b.BackColor = Color.FromArgb(52, 40, 30);
            b.ForeColor = ForeColor;
            bar.Controls.Add(b);
        }
        startButton.Text = "Start";
        stopButton.Text = "Stop (saves data)";
        browserButton.Text = "Open in browser";
        forceButton.Text = "Force stop (no save)";
        forceButton.Visible = false;
        status.AutoSize = true;
        status.Padding = new Padding(12, 8, 0, 0);
        bar.Controls.Add(status);

        log.Dock = DockStyle.Fill;
        log.ReadOnly = true;
        log.BackColor = Color.FromArgb(16, 13, 11);
        log.ForeColor = Color.FromArgb(220, 210, 190);
        log.Font = new Font("Consolas", 9.5f);
        log.BorderStyle = BorderStyle.None;
        log.WordWrap = false;
        Controls.Add(log);
        Controls.Add(bar);

        startButton.Click += delegate { StartAll(); };
        stopButton.Click += delegate { StopAll(); };
        browserButton.Click += delegate { Process.Start(WebUrl); };
        forceButton.Click += delegate { ForceStop(); };
        stopTimer.Interval = 1000;
        stopTimer.Tick += delegate { StopTick(); };
        FormClosing += OnClosing;

        Directory.CreateDirectory(Path.Combine(root, "logs"));
        string file = Path.Combine(root, "logs", "launcher-" + DateTime.Now.ToString("yyyy-MM-dd") + ".log");
        logFile = new StreamWriter(file, true, new UTF8Encoding(false));
        logFile.AutoFlush = true;
        Append("Log file: " + file);
        SetState();
        if (testCycle || autostart) Shown += delegate { StartAll(); };
        Thread server = new Thread(Serve);
        server.IsBackground = true;
        server.Start();
    }

    /** One command from the command line, run on the window's thread. */
    string Command(string line)
    {
        string[] parts = line.Trim().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        string cmd = parts.Length > 0 ? parts[0].ToLowerInvariant() : "";
        switch (cmd)
        {
            case "start":
                if (Running) return "Already running.";
                StartAll();
                return Running ? "Starting." : "Could not start; see the launcher log.";
            case "stop":
                if (!Running) return "Not running.";
                StopAll();
                return "Stopping.";
            case "status":
                return stopping ? "Stopping" : Running ? "Running" : "Stopped";
            case "log":
                int n;
                if (parts.Length < 2 || !int.TryParse(parts[1], out n)) n = 40;
                string[] lines = log.Lines;
                int from = Math.Max(0, lines.Length - n - 1);
                return string.Join(Environment.NewLine, lines, from, lines.Length - from).TrimEnd();
            case "show":
                if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                Activate();
                return "Shown.";
            default:
                return "Unknown command. Use start, stop, status or log [lines].";
        }
    }

    /** Answers commands sent through a named pipe, one per connection. */
    void Serve()
    {
        while (true)
        {
            try
            {
                using (NamedPipeServerStream pipe = new NamedPipeServerStream(PipeName(root), PipeDirection.InOut, 1))
                {
                    pipe.WaitForConnection();
                    StreamReader reader = new StreamReader(pipe);
                    StreamWriter writer = new StreamWriter(pipe);
                    string request = reader.ReadLine() ?? "";
                    string reply = (string)Invoke(new Func<string>(() => Command(request)));
                    writer.Write(reply);
                    writer.Flush();
                    pipe.WaitForPipeDrain();
                }
            }
            catch (Exception)
            {
                Thread.Sleep(200);
            }
        }
    }

    public static string PipeName(string root)
    {
        uint hash = 2166136261;
        foreach (char c in root.ToLowerInvariant().TrimEnd('\\'))
        {
            hash ^= c;
            hash *= 16777619;
        }
        return "HearthtableLauncher-" + hash.ToString("x8");
    }

    /** Sends one command to the open launcher; null when no launcher is open. */
    public static string Send(string root, string command, int timeoutMs)
    {
        try
        {
            using (NamedPipeClientStream pipe = new NamedPipeClientStream(".", PipeName(root), PipeDirection.InOut))
            {
                pipe.Connect(timeoutMs);
                StreamWriter writer = new StreamWriter(pipe);
                writer.WriteLine(command);
                writer.Flush();
                return new StreamReader(pipe).ReadToEnd();
            }
        }
        catch (Exception)
        {
            return null;
        }
    }

    bool Running { get { return child != null && !child.HasExited; } }

    void SetState()
    {
        startButton.Enabled = !Running;
        stopButton.Enabled = Running && !stopping;
        status.Text = stopping
            ? "Stopping: the emulators are saving their data..."
            : Running ? "Running" : "Stopped";
    }

    void Append(string line)
    {
        if (InvokeRequired)
        {
            BeginInvoke(new Action<string>(Append), line);
            return;
        }
        string clean = Ansi.Replace(line, "");
        string stamped = DateTime.Now.ToString("HH:mm:ss") + "  " + clean;
        log.AppendText(stamped + Environment.NewLine);
        log.SelectionStart = log.TextLength;
        log.ScrollToCaret();
        if (logFile != null) logFile.WriteLine(stamped);
        if (testCycle && clean.Contains("Hearthtable is running")) StopAll();
    }

    void StartAll()
    {
        if (Running) return;
        ProcessStartInfo info = new ProcessStartInfo("node", "scripts/start.mjs");
        info.WorkingDirectory = root;
        info.UseShellExecute = false;
        info.CreateNoWindow = true; // a hidden console of its own, shared by every child process
        info.RedirectStandardOutput = true;
        info.RedirectStandardError = true;
        info.RedirectStandardInput = true;
        info.StandardOutputEncoding = Encoding.UTF8;
        info.StandardErrorEncoding = Encoding.UTF8;
        // Start from the user's normal environment, whoever opened the launcher. A terminal such as
        // Git Bash changes the environment so that Ctrl+C no longer reaches pnpm and Firebase,
        // and Stop could not save. HEARTHTABLE_NO_BROWSER is kept for tests.
        System.Collections.Generic.Dictionary<string, string> clean = Native.UserEnvironment();
        if (clean != null)
        {
            string noBrowser = Environment.GetEnvironmentVariable("HEARTHTABLE_NO_BROWSER");
            info.EnvironmentVariables.Clear();
            foreach (System.Collections.Generic.KeyValuePair<string, string> kv in clean)
                info.EnvironmentVariables[kv.Key] = kv.Value;
            if (noBrowser != null) info.EnvironmentVariables["HEARTHTABLE_NO_BROWSER"] = noBrowser;
        }
        if (testCycle) info.EnvironmentVariables["HEARTHTABLE_NO_BROWSER"] = "1";
        child = new Process();
        child.StartInfo = info;
        child.EnableRaisingEvents = true;
        child.OutputDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) Append(e.Data); };
        child.ErrorDataReceived += delegate(object s, DataReceivedEventArgs e) { if (e.Data != null) Append(e.Data); };
        child.Exited += delegate { BeginInvoke(new Action(OnChildExited)); };
        // Windows passes "ignore Ctrl+C" down to child processes. If whoever opened the launcher
        // had it set (some terminals do), Stop could never reach the emulators; clear it first.
        Native.SetConsoleCtrlHandler(IntPtr.Zero, false);
        try
        {
            child.Start();
        }
        catch (Exception ex)
        {
            Append("Could not start node: " + ex.Message + " (is Node.js installed and on PATH?)");
            child = null;
            SetState();
            return;
        }
        Native.AssignProcessToJobObject(job, child.Handle);
        child.BeginOutputReadLine();
        child.BeginErrorReadLine();
        Append("Started.");
        SetState();
    }

    /** Sends Ctrl+C to the child's console, as pressing Ctrl+C in a terminal would. */
    void StopAll()
    {
        if (!Running || stopping) return;
        stopping = true;
        stopSeconds = 0;
        Append("Stopping (Ctrl+C)...");
        Native.FreeConsole();
        if (Native.AttachConsole((uint)child.Id))
        {
            Native.SetConsoleCtrlHandler(IntPtr.Zero, true); // the launcher ignores it itself
            Native.GenerateConsoleCtrlEvent(0, 0); // CTRL_C_EVENT to everything on that console
            Native.FreeConsole();
        }
        else
        {
            Append("Could not reach the processes' console (error " + Marshal.GetLastWin32Error() + "); use Force stop.");
        }
        try
        {
            // A batch file interrupted by Ctrl+C asks "Terminate batch job (Y/N)?" on its input.
            child.StandardInput.WriteLine("Y");
            child.StandardInput.Close();
        }
        catch (Exception)
        {
        }
        stopTimer.Start();
        SetState();
    }

    void StopTick()
    {
        stopSeconds++;
        if (stopSeconds == 1) Native.SetConsoleCtrlHandler(IntPtr.Zero, false);
        if (stopSeconds == 60)
        {
            Append("Still stopping after a minute. Force stop ends everything without saving emulator data.");
            forceButton.Visible = true;
        }
    }

    void ForceStop()
    {
        if (!Running) return;
        Append("Force stopping...");
        Process kill = Process.Start(new ProcessStartInfo("taskkill", "/T /F /PID " + child.Id)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        });
        kill.WaitForExit();
    }

    void OnChildExited()
    {
        stopTimer.Stop();
        Native.SetConsoleCtrlHandler(IntPtr.Zero, false);
        Append("Everything has stopped (exit code " + child.ExitCode + ").");
        stopping = false;
        forceButton.Visible = false;
        SetState();
        if (testCycle)
        {
            Environment.ExitCode = child.ExitCode == 0 ? 0 : 1;
            closeWhenStopped = true;
        }
        if (closeWhenStopped) Close();
    }

    void OnClosing(object sender, FormClosingEventArgs e)
    {
        if (!Running) return;
        e.Cancel = true;
        if (stopping && closeWhenStopped)
        {
            DialogResult answer = MessageBox.Show(this,
                "The emulators are still saving. Force quit without saving?",
                "Hearthtable Launcher", MessageBoxButtons.YesNo, MessageBoxIcon.Warning);
            if (answer == DialogResult.Yes) ForceStop();
            return;
        }
        closeWhenStopped = true;
        StopAll();
    }

    /** Command line mode: prints the open launcher's answer. */
    static int RunCommand(string root, string[] args)
    {
        Native.AttachConsole(0xFFFFFFFF); // the calling terminal, so the answer is printed there
        string cmd = args[0].ToLowerInvariant();
        string line = string.Join(" ", args);
        string reply = Send(root, line, 500);
        if (reply == null)
        {
            if (cmd == "start")
            {
                // Opened through the shell, so the window does not inherit this terminal's
                // console: Ctrl+C from Stop must reach only the launcher's own processes.
                Process.Start(new ProcessStartInfo(Application.ExecutablePath, "--autostart")
                {
                    UseShellExecute = true,
                    WorkingDirectory = root,
                });
                for (int i = 0; i < 50 && reply == null; i++)
                {
                    Thread.Sleep(200);
                    reply = Send(root, "status", 200);
                }
                Console.WriteLine(reply == null ? "Opened the launcher." : "Opened the launcher; " + reply + ".");
                return 0;
            }
            if (cmd == "log")
            {
                string file = Path.Combine(root, "logs", "launcher-" + DateTime.Now.ToString("yyyy-MM-dd") + ".log");
                Console.WriteLine(File.Exists(file) ? "The launcher is not open. Today's log: " + file : "The launcher is not open.");
                return 0;
            }
            Console.WriteLine(cmd == "status" ? "Stopped (the launcher is not open)." : "The launcher is not open.");
            return cmd == "status" ? 0 : 1;
        }
        if (cmd == "stop" && reply == "Stopping.")
        {
            Console.WriteLine("Stopping; waiting for the emulators to save...");
            for (int i = 0; i < 180; i++)
            {
                Thread.Sleep(1000);
                string state = Send(root, "status", 500);
                if (state == null || state == "Stopped")
                {
                    Console.WriteLine("Stopped.");
                    return 0;
                }
            }
            Console.WriteLine("Still stopping after three minutes; see the launcher window.");
            return 1;
        }
        Console.WriteLine(reply);
        return 0;
    }

    [STAThread]
    static void Main(string[] args)
    {
        string root = AppDomain.CurrentDomain.BaseDirectory;
        if (!File.Exists(Path.Combine(root, "scripts", "start.mjs")))
        {
            MessageBox.Show("Put the launcher in the Hearthtable folder (next to package.json).",
                "Hearthtable Launcher", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        string[] commands = { "start", "stop", "status", "log" };
        if (args.Length > 0 && Array.IndexOf(commands, args[0].ToLowerInvariant()) >= 0)
        {
            Environment.Exit(RunCommand(root, args));
            return;
        }
        // A second window would fight the first for the same ports: bring the open one forward.
        if (Send(root, "show", 300) != null) return;
        bool test = Array.IndexOf(args, "--test-cycle") >= 0;
        Application.EnableVisualStyles();
        bool autostart = Array.IndexOf(args, "--autostart") >= 0;
        Application.Run(new LauncherForm(root, test, autostart));
    }
}
