import { repositoryContract } from "./contract.test-helpers";
import { memoryRepository } from "./memory";

repositoryContract("memory", async () => memoryRepository());
