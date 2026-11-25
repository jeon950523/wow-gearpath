# WoW GearPath 기준 문서

- 웹 저장소의 [계약 v1](../contracts/snapshot-v1.schema.json)이 애드온 JSON의 정본입니다. [버전 기록](../contracts/CHANGELOG.md) · [로드맵](ROADMAP.md)
- 애드온 스냅샷은 브라우저 메모리에서 검증하고 장비 세트와 재화의 출처 및 시각을 유지합니다.

- 대상은 한국 리테일입니다. 장착 평균 315 이상에서 레이드와 쐐기 후보를 추가합니다.
- Next.js App Router와 TypeScript가 웹 입력과 서버 요청을 처리합니다. 추천은 웹과 CLI가 같은 JavaScript 엔진을 사용합니다.
- Blizzard OAuth 자격증명은 Vercel Production 서버에만 두고 공개 캐릭터 및 게임 데이터 API에 사용합니다.
- 장착 평균은 반올림 전 값을 비교합니다. 누락 장비나 무기 유형 미확인 시 판정을 보류합니다.
- `src/rules.mjs`가 시즌과 규칙의 출처·확인 상태를 관리합니다. 확인 자료는 [데이터 출처](data-sources.md)에 기록합니다.
- 보유량의 `null`은 미입력입니다. 수동 입력은 브라우저 메모리에서 처리하고 최근 검색만 해당 브라우저에 저장합니다.
- 제출 기준은 단위 테스트, Production 빌드, 헤드리스 E2E, GitHub Actions 확인입니다.
- 작업 현황과 인계는 [HANDOFF](HANDOFF.md)를 참고합니다.
