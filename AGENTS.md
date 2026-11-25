# 웹 저장소 개발 원칙

[SSOT](docs/SSOT.md), [HANDOFF](docs/HANDOFF.md), [계약 변경 기록](contracts/CHANGELOG.md)과 양쪽 최신 main을 확인합니다. 애드온 저장소는 웹 작업에서 읽기 전용입니다.

계약과 필드 정의 → 익명 fixture → 병렬 구현 → 독립 검증 → 웹 정본 교차 검증 → 검수·병합 → 배포 확인 순서로 진행합니다. 소스 SHA와 실제 게임·모의 결과를 각각 기록합니다.

로컬에서 npm ci, 단위·교차 테스트, Production 빌드, 헤드리스 E2E, 민감 정보 검사를 진행합니다. GitHub Actions는 수동 실행만 사용합니다. Vercel은 main에서 Production 자동 배포하며 기능 브랜치는 자동 배포하지 않습니다. 필수 검사 정책을 우회하지 않습니다.
