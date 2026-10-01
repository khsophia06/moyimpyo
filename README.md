# 모임표

초대 링크로 가능한 시간을 모으고 장소를 제안·투표하는 한국어 모임 조율 앱입니다. React/Vite, Express, SQLite로 구성되어 있습니다.

## 로컬 실행

Node.js 24 이상이 필요합니다.

```sh
npm ci
npm run dev
```

http://localhost:3000 에서 확인합니다. 기본 데이터베이스는 `data/moimpyo.sqlite`이며 서버를 다시 시작해도 유지됩니다. 주최자는 계정을 만들고, 참여자는 초대 링크에서 가입 없이 응답할 수 있습니다. 비회원 응답 수정은 해당 브라우저의 쿠키에 연결됩니다.

## 검증

```sh
npm test
npm run build
npm run test:e2e
```

단위·API 테스트는 시간 계산, 인증과 권한, 참여자 격리, 투표 수정, 설정 변경 및 DB 재시작 후 저장 상태를 확인합니다. E2E는 설치된 Microsoft Edge를 사용하며 3100 포트에서 별도 서버와 `data/e2e.sqlite`를 사용합니다. 데스크톱 주최자와 모바일 크기의 별도 참여자 브라우저로 생성부터 시간·장소 확정까지 확인합니다. 실행 중인 다른 서버가 3100 포트를 사용하지 않아야 합니다. 캡처와 실패 추적은 `test-results/`에 저장됩니다.

## 운영 실행

```sh
npm run build
npm start
```

운영 환경에는 실제 공개 HTTPS 주소를 `APP_ORIGIN` 환경 변수로 설정해야 합니다. `.env.example`은 설정 예시이며 `npm start`가 `.env` 파일을 자동으로 읽지는 않습니다. 환경 변수를 직접 설정하거나 `node --env-file=.env server/index.js --production`으로 실행하세요.

Docker Compose를 사용할 때는 `.env.example`을 `.env`로 복사하고 실제 주소로 변경한 뒤 실행합니다.

```sh
docker compose up --build -d
```

현재 Compose는 로컬 3000 포트에 연결하며 HTTPS 역방향 프록시 1개 뒤에서 동작하도록 설정되어 있습니다. TLS 프록시와 도메인은 별도로 구성해야 합니다. SQLite는 `moimpyo-data` 볼륨에 저장됩니다. `TRUST_PROXY=1`은 해당 프록시 구성에서만 사용하세요.

## 주요 파일

- `src/`: 홈, 로그인, 모임 설정, 시간표, 장소 투표 화면
- `server/`: API, 인증, 입력 검증, SQLite 저장
- `shared/time.js`: 30분 단위 시간표와 연속 참석 가능 인원 계산
- `tests/`, `e2e/`: API·계산 및 브라우저 검증
- `DESIGN.md`: 기존 디자인 기준
- `WORK_STATUS.md`: 이어서 작업할 때 확인할 구현·검증 상태
