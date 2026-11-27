# TASK-006-4 검수 — 상인·제작 관측 저장

2026-11-27 KST. 웹 시작 main 98ee22baad07524b4193e27cb2259a7c6481ef60. 애드온 main 48ec8d4e0a1d2b5c45662498d58b74d8f6bd40be, 제작·공통 저장 제안 90b574c0162b1d4da8f9afafcc725fb87e2e08a9, 상인 289fa52de7478b700ed564f8ccddf6e15eac83cb, 활동 e73bd3c4d9f80bebc1084720ab98a205876ebe3c, 강화 9a1b7122a340a4c955f327e45d3d0d53b2f3d85d, 전역퀘 c9752c7f540a6baed1795a884ccc54c88539c9d1. 웹 정본·스키마 및 예제 2f9d167248202ff81e98c419ac5cb867c0a59528. 애드온 읽기 전용.

- 근거. 애드온 SSOT/HANDOFF, Storage.lua, 상인 Collector와 MERCHANT-001, 제작 CRAFT-001 및 Selected/Preview/Inventory의 공개 결과 범위를 대조했다. 저장 제안의 단일 소유자·버전 분리·크기·append 정책을 채택했다. 기존 진단 텍스트는 새 JSON으로 간주하지 않는다. serializer는 안정된 allowlist 및 null 정책, 제작 중첩 그룹과 typed ID 구조에 맞춰야 한다.
- 기능 검수. 신규 저장 및 종류별 Ajv 스키마와 의미 검증을 분리했다. 목록 위치/개수, 가격·교환 상태, 재료 범위·잔액/차이, 미리보기 출처, 장비 및 슬롯 참조, 캐릭터 중복·크기·시간 역전을 검증했다. 같은 초의 다른 원문을 유지하고 관측을 비용/결과/효과/소모/가능 판정으로 바꾸지 않는다.
- 효율 및 개인정보. 검증은 크기 제한 후 파일별 데이터에 수행하며 원문/개인 값은 오류 메시지에 출력하지 않는다. 기존 운영·강화 스키마와 웹 가져오기 UI는 변경하지 않았다. 서버 API나 추천 엔진에 연결하지 않았다.
- 직접 검증. Windows Node 환경에서 npm test 154/154, 신규 계약 케이스 30개 포함. npm run build 성공. 클라이언트 빌드에서 신규 저장 전역 및 kind 문자열 검색 결과 0건. 브라우저 E2E는 신규 사용 경로가 없어 이번 범위에서 미실행. GitHub Actions 수동 정책 유지, 새 실행 없음.
- 증거 구분. JSON 및 Lua 저장 형태 예제는 합성이다. 실제 애드온 serializer/저장·재장전·두 캐릭터, 실게임 상인·제작 UI 및 비용, Lua 5.1/5.4 교차 실행은 미검증이다. 앱에서 신규 Lua 파일을 가져오는 기능 및 추천은 포함하지 않았다.
- 인수. [웹 정본](../contracts/GROWTH-DIAGNOSTICS-STORAGE-001.md)의 pinned SHA를 애드온 serializer/체크포인트 구현에 사용하고 기존 본 TASK와 ADDON 순서를 유지한다.

## PR #11 최종 검수 (2026-11-27)

최종 정본 SHA 91da6d7706aa4d336ef0a7210a79a66d1a3c00f5. 양쪽 main과 진행 브랜치를 재조회했다. 웹 main 98ee22baad07524b4193e27cb2259a7c6481ef60, 애드온 main 48ec8d4e0a1d2b5c45662498d58b74d8f6bd40be, 제작·통합 b59fa9abfea1200240e5f9668f165be694c2c7d6, 상인 289fa52de7478b700ed564f8ccddf6e15eac83cb. [애드온 최종 인계](https://github.com/jeon950523/wow-gearpath-addon/blob/b59fa9abfea1200240e5f9668f165be694c2c7d6/HANDOFF.md) · [공통 저장 검수](https://github.com/jeon950523/wow-gearpath-addon/blob/b59fa9abfea1200240e5f9668f165be694c2c7d6/docs/reports/ADDON-006-2-1-common-storage.md)

- 제작 잔액 288개와 분류 2,048개를 전량 받는다. 상인 64×8은 합성 최대 관측에서 64 KiB를 넘으며 128 KiB로 조정했다. 제작 최대 분류도 256 KiB를 넘으므로 768 KiB로 조정했다. 컨테이너 합계 2 MiB, 유형당 최대 8건, 무음 절삭 금지는 유지한다.
- 신원·시각·슬롯 근거가 남은 명시 레시피 partial은 보존하고, 미확인 옵션은 null 쌍으로 표현한다. 원시 품질/레벨 0을 보존하며 실제 품질/레벨, 유효 ID·배정량과 구분한다. raw 0 및 partial 정책은 다음 애드온 serializer 버전에서 반영해야 한다. 실패와 문맥 변경은 저장하지 않는다.
- 기존 애드온 codec의 제한된 JSON 문법, 미관측 값, 배정 합계와 필수 슬롯·원본 비교에 웹 검증기를 맞췄다. 원격의 생성 예제 2종을 웹 Ajv와 의미 검증에 통과시켜 웹 합성 예제와 객체 단위로 대조했다. 고정 소스의 기존 애드온 테스트를 Windows Fengari 0.1.4(Lua 5.3 모델)에서 실행했다. 상인 12+5, 제작 13, 체크포인트 15, 공통 저장 19, CraftSim 모의 10, 총 74/74 통과. 그중 기존 상한 및 partial 거부 검사는 변경 전 구현의 결과다. 새 한도와 partial wire는 웹 신규 반례에서 확인했으며 애드온에는 아직 반영되지 않았다.
- 전체 웹 단위·계약 160/160(신규 계약 파일 36건), Production 빌드 성공, 신규 진단 식별자의 클라이언트 번들 검색 0건. 기존 UI 헤드리스 E2E 12/12. CI 신규 실행은 요청하지 않았다.
- CraftSim은 독립 advisory v1 스키마만 정의했다. API 참조 버전·SHA, 비교 범위/시각/신선도 출처가 직접 관측에 섞이지 않는다. 실제 provider·저장·인게임 패치 검증, 신규 serializer의 영속 저장/reload/네이티브 Lua 5.1/5.4는 후속이다. 기성 애드온 활용 우선 정책 및 예외 검토 기준은 AGENTS와 공통 정책에 동기화했다.
