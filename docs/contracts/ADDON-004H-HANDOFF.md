# ADDON-004H 전역퀘 웹 계약 인계

웹 계약 커밋 37cd8c3cd28ad783d38c4b7f863d91d2584a6f62. 애드온 제안 0201743562d417fa64264fb0133495fbfed2dc00. [애드온 제안과 실측 한계](https://github.com/jeon950523/wow-gearpath-addon/blob/0201743562d417fa64264fb0133495fbfed2dc00/docs/reports/ADDON-004H-contract-handoff.md) · [웹 v1 정본](../../contracts/snapshot-v1.schema.json) · [웹 의미 검증](../../src/world-quests.mjs).

## 확정 범위

- 선택적 worldQuests 객체. 생략은 이전 형식 또는 미수신이고 빈 rows는 해당 스캔 결과다. region/realm/name/seasonId/patch는 바깥 스냅샷에서 상속한다. scan context의 specializationIndex는 전문화 인덱스이며 lootSpecializationId 0은 현재 전문화 사용을 나타낸다. 내부 GUID와 계정 ID는 보내지 않는다.
- 수집 시작·종료, 현재 활성·만료·보상 관측 시각을 UTC 초 단위로 제공한다. 관측 순서, 고유 ID, 64개 지도·후보, 300개 퀘스트 행, 그룹별 20개 보상, 전체 UTF-8 256 KiB를 지킨다.
- 활성·완료·만료가 미확인인 행과 캐시는 참고 정보다. 캐시는 현재 그룹과 별도로 원래 시각을 유지하고 수집기가 캐릭터·전문화·발생 회차 일치를 확인한다. 웹에서는 캐시를 합치거나 부분합에 포함하지 않는다.
- 확인된 골드는 양수 구리다. 원시 0은 zeroUnverified/null이다. 확인된 빈 배열과 수집 실패를 구분한다. 확정 장비·화폐는 따로 집계하며 선택 아이템 및 보유량은 집계에서 제외한다. 화폐 factionId는 평판 연계 표시에만 쓴다.
- 모듈 시각이 더 최신인 스캔으로 원자 교체한다. 동시각 충돌과 컨텍스트가 더 이상 확인되지 않는 과거 스캔은 참고용으로 유지한다. 15분 TTL은 웹의 초기 보수 정책이다.

## 004H 초안 대비 웹 확정 사항

- 완전한 관측 스캔은 빈 목록을 허용한다. observed에는 최소 한 개의 성공 지도와 mapExpansion=ok가 필요하다. 실패한 지도는 발견 출처로 쓰지 않는다.
- 한 보상 그룹에서 currencyId를 중복 제공하면 거부한다. 골드 및 화폐별 확인 수량 합계는 안전 정수 범위여야 한다. JSON Schema 구조 조건과 시각 비교·count 일치 등 런타임 의미 검증을 둘 다 통과해야 한다.
- 위치 모호 행도 현재 보상 자체는 표시할 수 있다. 위치 기반 판단에는 명시적·직접 지역 API·계층 해석 출처만 사용하며 좌표 정확성은 별도 검증한다.

## ADDON-004I 통합 조건

이 SHA로 serializer를 대조하고 위 변경 항목을 애드온 담당자가 확인한 뒤 운영 수집기에 연결한다. Lua 5.1/5.4, 설치 ZIP, 0.3.2 회귀, 실제 v0.4.0 게임 내 내보내기 및 웹 교차 검증이 남아 있다. 실제 툴팁·캐시 복구·선택 보상·원시 골드 0의 의미는 현장 확인이 필요하다. 이번 웹 검증에는 [004H 합성 스냅샷](../../contracts/examples/world-quests-004h-synthetic.json)을 사용했다.
