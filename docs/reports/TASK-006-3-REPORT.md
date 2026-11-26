# TASK-006-3 — SavedVariables 검수

웹 정본 b6c1e09552c5ba0dcb1492a3a5dcac57761e58a7. [정본](../contracts/SAVEDVARIABLES-001.md) · [애드온 제안](https://github.com/jeon950523/wow-gearpath-addon/blob/df3be9d5474ae3adc5bf16494aa8cf100c997000/docs/contracts/SAVEDVARIABLES-001-PROPOSAL.md) · [양쪽 기준 SHA](TASK-006-2-REPORT.md)

- 기능 검수. 실제 운영 TOC/Core의 legacy WowGearPathDB.lastExport 확인 후 v0, 제안에 맞춘 두 v1 루트를 구현했다. src/saved-variables.mjs는 제한 문법과 10 MiB/2 MiB/깊이/필드/문자열 한도를 검증한다. 긴 Lua 블록, 희소·문자열 배열 키, 함수·후행 코드, 중복 키와 프로토타입 키를 거부한다. app/saved-variables-import.tsx와 planner에서 한 파일의 여러 캐릭터를 선택하고 기존 JSON 계약으로 가져오거나 내려받는다. 진단은 운영 가져오기에서 분리한다.
- 보안 및 시각. 원본 파일은 실행·전송·서버 저장하지 않는다. 다운로드에서 원시 링크와 정규화 내부 필드를 제거한다. 동일 캐릭터의 이전 full은 별도 기록으로만 표시하고 기존 15분 TTL 및 장비 24시간 판정을 유지한다. 손상 파일은 기존 정상 진단을 유지한다. 캐릭터 전환 시 이전 장비/전역퀘/수동 재화를 결합하지 않는다.
- 효율 검수. 입력은 파일별로 순차 읽기, 파서는 단일 인덱스와 개수·깊이 제한, 인식 후 JSON만 유지한다. 이스케이프된 문자열에는 크기를 제한한 UTF-8 작업 버퍼를 사용한다. 파일 입출력과 UI를 순수 파서에서 분리했으며 자동 감시나 추가 HTTP를 도입하지 않았다. 실행 성능 개선 폭은 계측하지 않았다.
- 직접 검증. Windows, Node v26.13.0, npm 11.20.0, 기존 헤드리스 Chromium. npm ci 성공, npm test 124/124, npm run build 성공, npm run test:e2e 12/12. 클라이언트에서 보호 문자열 및 Blizzard 인증 주소/시크릿 이름 검색 0건. E2E는 합성 v1 다중 캐릭터, 옛 전역퀘, 다운로드 내용·시각, 손상 파일 유지 및 네트워크 미전송을 검증한다.
- 인수 상태. 실제 두 캐릭터의 WoW 출력, 저장/reload, Lua 5.1/5.4 및 애드온 ZIP·인게임 교차 승인 미실행. 애드온 담당이 [ADDON-UPGRADE-001-7](https://github.com/jeon950523/wow-gearpath-addon/blob/df3be9d5474ae3adc5bf16494aa8cf100c997000/tasks/ADDON-UPGRADE-001-7.md)과 [ADDON-004I-5](https://github.com/jeon950523/wow-gearpath-addon/blob/df3be9d5474ae3adc5bf16494aa8cf100c997000/tasks/ADDON-004I-5.md)에서 정본 SHA를 사용한다. 애드온 저장소를 수정하지 않았다.
