import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {diagnose} from './engine.mjs';
import {sample} from './sample.mjs';
import {createBlizzardClient} from './blizzard.mjs';
import {renderReport} from './report.mjs';

async function main() {
  const [command,...args]=process.argv.slice(2);
  let snapshot,report;
  if (command==='demo') {
    snapshot=sample();
    report=diagnose(snapshot,{demo:true,now:'2026-11-26T10:00:00+09:00'});
  } else if (command==='diagnose') {
    if (!args[0]) throw new Error('사용법: npm run diagnose -- <snapshot.json> [report.html]');
    const file=await readFile(resolve(args[0]),'utf8');
    if (Buffer.byteLength(file)>1048576) throw new Error('입력은 1MiB 이하여야 합니다.');
    snapshot=JSON.parse(file);
    report=diagnose(snapshot);
  } else if (command==='live') {
    if (!args[0] || !args[1]) throw new Error('사용법: npm run live -- <realm-slug> <character-name> [report.html]');
    snapshot=await createBlizzardClient({clientId:process.env.BLIZZARD_CLIENT_ID,clientSecret:process.env.BLIZZARD_CLIENT_SECRET}).character(args[0],args[1]);
    report=diagnose(snapshot);
  } else throw new Error('사용법: npm run demo | npm run diagnose -- <snapshot.json> [report.html] | npm run live -- <realm-slug> <name> [report.html]');
  const htmlPath=resolve(command==='demo' ? args[0]??'sample-report.html' : command==='live' ? args[2]??'private/live-report.html' : args[1]??'private/report.html');
  await mkdir(dirname(htmlPath),{recursive:true});
  await writeFile(htmlPath,renderReport(report),'utf8');
  // Private by default for actual character data. Demo stays shareable.
  if(command==='demo') {
    await mkdir(resolve('examples'),{recursive:true});
    await writeFile(resolve('examples/sample.json'),JSON.stringify(snapshot,null,2)+'\n');
    await writeFile(resolve('examples/sample-result.json'),JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify({character:report.character.name,average:report.rawAverage,groupEligible:report.groupEligible,upgradeSteps:report.upgrades.length,report:htmlPath,warnings:report.warnings},null,2));
}
main().catch(error=>{console.error(error instanceof SyntaxError?'JSON 형식이 올바르지 않습니다.':error.message);process.exitCode=1;});
