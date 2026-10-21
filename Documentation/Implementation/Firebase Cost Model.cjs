// Planning arithmetic only. No Firebase SDK, credentials, network or production writes.
// USD rate assumptions checked 2026-10-19; see companion Markdown for sources/limits.
const assert = require('node:assert/strict');
const KiB=1024, MiB=KiB**2, GiB=KiB**3, GB=1e9;
const rates={readsFreeDaily:50000,writesFreeDaily:20000,readPer100k:0.03,writePer100k:0.09,
  firestoreFreeGiBMonthly:10,firestorePerGiB:0.12,hostingFreeBytesDaily:360e6,hostingPerGB:0.15};
const assumptions={days:30,homeDocuments:5,characterDocuments:10,homeDocumentBytes:2*KiB,
  characterDocumentBytes:10*KiB,panelDocuments:1,panelBytes:10*KiB,roundTripsDaily:10,
  dependentRuleReadsPerDeliveredDocument:2,sharedWriteFraction:0.5,liveDocumentBytes:2*KiB,
  transferMargin:1.5,appBytesPerColdLoad:2*MiB,portraitBytes:MiB,portraitCount:50,
  databaseStartingBytesIncludingIndexes:100*MiB,retainedLogBytesPerWrite:4*KiB};
const traffic={
  expected:{uniqueDaily:15,homeViews:10,personalSheets:10,guestSheets:5,switchers:5,
    sharedAudience:10,personalAudience:1.5,partyPortraitsPerHome:10},
  high:{uniqueDaily:33,homeViews:33,personalSheets:25,guestSheets:0,switchers:10,
    sharedAudience:33,personalAudience:1,partyPortraitsPerHome:33},
};
const excess=(used,free)=>Math.max(0,used-free);
function estimate(name,writesDaily,options={}){
  const t=traffic[name],a=assumptions,r=rates;
  const sheets=t.personalSheets+t.guestSheets;
  const panelSwitches=t.switchers*a.roundTripsDaily*2;
  const panelReads=options.cachedPanels?0:panelSwitches*a.panelDocuments;
  const initialReads=t.homeViews*a.homeDocuments+sheets*a.characterDocuments;
  const audience=a.sharedWriteFraction*t.sharedAudience+(1-a.sharedWriteFraction)*t.personalAudience;
  const updateReads=writesDaily*audience;
  const deliveredReadsDaily=initialReads+panelReads+updateReads;
  const readsDaily=deliveredReadsDaily*(1+a.dependentRuleReadsPerDeliveredDocument);
  const liveBytes=options.liveDocumentBytes??a.liveDocumentBytes;
  const bytesDaily=(t.homeViews*a.homeDocuments*a.homeDocumentBytes+sheets*a.characterDocuments*a.characterDocumentBytes
    +panelReads*a.panelBytes+updateReads*liveBytes)*a.transferMargin;
  const databaseGiBMonthly=bytesDaily*a.days/GiB;
  const hostingBytesDaily=(t.homeViews+sheets)*a.appBytesPerColdLoad;
  const portraitsDaily=t.homeViews*t.partyPortraitsPerHome+sheets;
  const portraitDownloadsMonthly=portraitsDaily*a.days;
  const portraitDownloadedGB=portraitDownloadsMonthly*a.portraitBytes/GB;
  const databaseEndingGiB=(a.databaseStartingBytesIncludingIndexes+
    writesDaily*a.days*a.retainedLogBytesPerWrite)/GiB;
  // Only evaluate current bounded scenarios; add overage pricing before enlarging them.
  assert(databaseEndingGiB<1 && portraitDownloadedGB<100 && portraitDownloadsMonthly<50000);
  const readCostMonthly=excess(readsDaily,r.readsFreeDaily)/100000*r.readPer100k*a.days;
  const writeCostMonthly=excess(writesDaily,r.writesFreeDaily)/100000*r.writePer100k*a.days;
  const networkCostMonthly=excess(databaseGiBMonthly,r.firestoreFreeGiBMonthly)*r.firestorePerGiB;
  const hostingCostMonthly=excess(hostingBytesDaily,r.hostingFreeBytesDaily)/GB*r.hostingPerGB*a.days;
  return{name,uniqueDaily:t.uniqueDaily,openPageViews:t.homeViews+sheets,
    writesDaily,panelSwitches,panelReads,initialReads,averageAudience:audience,readsDaily,
    databaseGiBMonthly,databaseEndingGiB,hostingMiBDaily:hostingBytesDaily/MiB,
    portraitDownloadsMonthly,portraitDownloadedGB,readCostMonthly,writeCostMonthly,
    networkCostMonthly,hostingCostMonthly,
    modeledSubtotalMonthly:readCostMonthly+writeCostMonthly+networkCostMonthly+hostingCostMonthly};
}
const scenarios=Object.fromEntries(Object.keys(traffic).map(name=>[name,
  [0,400,1000,5000].map(w=>estimate(name,w))]));
const sensitivity={highFiveThousandLargeLiveDocuments:estimate('high',5000,{liveDocumentBytes:10*KiB}),
  expectedCachedPanels:estimate('expected',0,{cachedPanels:true}),highCachedPanels:estimate('high',0,{cachedPanels:true})};
const readFreeThresholds=Object.fromEntries(Object.keys(traffic).map(name=>{
  const base=estimate(name,0);const perWrite=base.averageAudience*(1+assumptions.dependentRuleReadsPerDeliveredDocument);
  const persistedWrites=Math.floor((rates.readsFreeDaily-base.readsDaily)/perWrite);
  return[name,{persistedWritesDaily:persistedWrites}];
}));
assert.equal(estimate('expected',0).readsDaily,900);
assert.equal(estimate('high',0).readsDaily,1845);
assert.equal(estimate('high',1000).readsDaily,52845);
assert(Math.abs(estimate('high',1000).modeledSubtotalMonthly-0.025605)<1e-9);
assert.equal(estimate('expected',1000).modeledSubtotalMonthly,0);
assert.equal(readFreeThresholds.high.persistedWritesDaily,944);
console.log(JSON.stringify({checked:'2026-10-19',currency:'USD',rates,assumptions,traffic,
  scenarios,sensitivity,readFreeThresholds},null,2));
