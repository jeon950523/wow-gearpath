# TASK-006 검수 보고서

## 기준 및 변경 범위

웹 시작 main 63d459a9e00366144066aa2f7c840b65da07334b. 애드온 main d4ac483a629f186611b89f2b7d4c706ea8e26c4c, 전역퀘 193efdceb9c87206280a476c4ade4d0987e48a4b, 강화 3e433b845c642c97815e1dce716b8d25c5dcd9c0, 재화 PR #2 cdf805a1e5150e6949fa2129e69afa19a2082214. 웹만 수정했다.

- app/planner.tsx 및 app/globals.css에서 캐릭터 요약·목표 차이·강화 단계·주요 재화·관측 출처와 갱신 상태·DPS 미측정·오늘 할 일·주간 활동을 통합했다.
- app/world-quest-panel.tsx 및 app/format-copper.ts에서 검증된 표시 보상과 이전 캐시를 분리 표시한다. 원래 정수 코퍼는 src/activity-dashboard.mjs에서 정수 단위로 분해한다. 보유 골드·표시 보상·성장 예산의 데이터 경로는 독립이다.
- src/activity-dashboard.mjs는 기간·상태·관측·추천을 분리한 활동 모델을 제공한다. 기존 금고 진행 및 구렁 단계 관측만 표시하고, 나머지 주간 항목은 미수집이다. 초기화 귀속, 보상 수령, 완료·미완료를 관측 수치로 추정하지 않는다. src/engine.mjs의 장비 최신성 판정을 화면에서 재사용한다.
- test/activity-dashboard.test.mjs와 e2e/addon.spec.ts는 정수 경계·0·주간 미수집·DPS·CLI·통합 화면을 추가 검증한다. 기존 전역퀘 테스트의 단위 문자열을 갱신했다.

## 검수

기능. 사용자 입력 목표와 현재 장착 평균을 같은 진단으로 계산한다. 기존 세트/무기/장신구 보존 판단, 성장 경로의 비용 검증, 3418/3513 처리, 315와 솔플 정책을 유지한다. 퀘스트의 캐시·오래된 관측·만료 미확인은 확정 부분합에 들어가지 않는다. 주간 수동 관측 0은 미수집과 구별한다. 심크 결과와 KR 초기화 관측이 아직 없다.

효율. 병합 스냅샷과 진단 결과는 분석 입력이 바뀔 때 다시 계산한다. 가져오기 입력상자나 미적용 재화 폼을 편집할 때 기존 진단을 재사용한다. 전역퀘와 장비/재화 신선도 경계에 단일 예약을 사용한다. 슬롯 조회는 키로 연결한다. 추가 API, 폴링, 서버 저장, 설치형 앱, 새 의존성 없이 구현했다. 실행 시간 개선 폭은 계측하지 않았다.

## 직접 검증

Windows, Node v26.13.0, npm 11.20.0, 기존 Chromium 헤드리스. npm ci 성공 및 취약점 보고 0건. npm test 91개 통과·0개 실패, npm run build 성공, npm run test:e2e 10개 통과·0개 실패. 보호 필드·가져오기 미전송 회귀 및 클라이언트 번들 인증 변수/주소 검색 0건을 확인했다. 초기 TypeScript 콜백 타입 오류와 E2E 문자열 중복 선택을 수정한 뒤 전체를 다시 검증했다. 병합 및 운영 검증 증적은 웹 PR에 기록한다.

## 실제 게임 및 후속 인계

검증은 웹의 기존 합성 예제를 사용했다. [ADDON-004I 어댑터 검수](https://github.com/jeon950523/wow-gearpath-addon/blob/193efdceb9c87206280a476c4ade4d0987e48a4b/docs/reports/ADDON-004I-serializer-review.md)는 Lua 5.4 독립 테스트이며 운영 수집기 연결 및 실게임 export는 남아 있다. [ADDON-UPGRADE-001](https://github.com/jeon950523/wow-gearpath-addon/blob/3e433b845c642c97815e1dce716b8d25c5dcd9c0/docs/reports/ADDON-UPGRADE-001-observations.md)은 NPC에서 사용자가 선택한 다음 강화 단계의 진단이다. 실제 가격, 기본 비용과 적용 비용, 할인·watermark·슬롯 의미를 KR UI 대조하기 전 소비 계약을 활성화하지 않는다.

다음 우선순위는 실제 전역퀘 내보내기 교차 검증과 P0 강화 관측 실측·계약 준비다. 구렁·금고의 수신 계약이 확정되면 주간 관측에 연결하고, SIM-001은 독립 준비 범위를 유지한다.

완료 직전 전역퀘 브랜치를 다시 조회했다. 새 head bfe0cd38c401c76d00cdfe7a04bafd5ff6385cbc에 v0.4.0 운영 통합 후보가 생겼다. 애드온 보고서의 Lua 5.4 mock 검증은 37/37이며, 실제 게임 export·ZIP·전체 회귀는 아직 준비되지 않았다. 웹에서 실제 인게임 교차 검증은 대기한다. [최신 통합 후보 검수](https://github.com/jeon950523/wow-gearpath-addon/blob/bfe0cd38c401c76d00cdfe7a04bafd5ff6385cbc/docs/reports/ADDON-004I-integration-candidate.md)
