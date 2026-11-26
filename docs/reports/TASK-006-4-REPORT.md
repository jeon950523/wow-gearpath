# TASK-006-4 검수 — 상인·제작 관측 저장

2026-11-27 KST. 웹 시작 main 98ee22baad07524b4193e27cb2259a7c6481ef60. 애드온 main 48ec8d4e0a1d2b5c45662498d58b74d8f6bd40be, 제작·공통 저장 제안 90b574c0162b1d4da8f9afafcc725fb87e2e08a9, 상인 289fa52de7478b700ed564f8ccddf6e15eac83cb, 활동 e73bd3c4d9f80bebc1084720ab98a205876ebe3c, 강화 9a1b7122a340a4c955f327e45d3d0d53b2f3d85d, 전역퀘 c9752c7f540a6baed1795a884ccc54c88539c9d1. 웹 정본·스키마 및 예제 2f9d167248202ff81e98c419ac5cb867c0a59528. 애드온 읽기 전용.

- 근거. 애드온 SSOT/HANDOFF, Storage.lua, 상인 Collector와 MERCHANT-001, 제작 CRAFT-001 및 Selected/Preview/Inventory의 공개 결과 범위를 대조했다. 저장 제안의 단일 소유자·버전 분리·크기·append 정책을 채택했다. 기존 진단 텍스트는 새 JSON으로 간주하지 않는다. serializer는 안정된 allowlist 및 null 정책, 제작 중첩 그룹과 typed ID 구조에 맞춰야 한다.
- 기능 검수. 신규 저장 및 종류별 Ajv 스키마와 의미 검증을 분리했다. 목록 위치/개수, 가격·교환 상태, 재료 범위·잔액/차이, 미리보기 출처, 장비 및 슬롯 참조, 캐릭터 중복·크기·시간 역전을 검증했다. 같은 초의 다른 원문을 유지하고 관측을 비용/결과/효과/소모/가능 판정으로 바꾸지 않는다.
- 효율 및 개인정보. 검증은 크기 제한 후 파일별 데이터에 수행하며 원문/개인 값은 오류 메시지에 출력하지 않는다. 기존 운영·강화 스키마와 웹 가져오기 UI는 변경하지 않았다. 서버 API나 추천 엔진에 연결하지 않았다.
- 직접 검증. Windows Node 환경에서 npm test 154/154, 신규 계약 케이스 30개 포함. npm run build 성공. 클라이언트 빌드에서 신규 저장 전역 및 kind 문자열 검색 결과 0건. 브라우저 E2E는 신규 사용 경로가 없어 이번 범위에서 미실행. GitHub Actions 수동 정책 유지, 새 실행 없음.
- 증거 구분. JSON 및 Lua 저장 형태 예제는 합성이다. 실제 애드온 serializer/저장·재장전·두 캐릭터, 실게임 상인·제작 UI 및 비용, Lua 5.1/5.4 교차 실행은 미검증이다. 앱에서 신규 Lua 파일을 가져오는 기능 및 추천은 포함하지 않았다.
- 인수. [웹 정본](../contracts/GROWTH-DIAGNOSTICS-STORAGE-001.md)의 pinned SHA를 애드온 serializer/체크포인트 구현에 사용하고 기존 본 TASK와 ADDON 순서를 유지한다.
