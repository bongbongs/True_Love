## 만들 앱: OneCall (가칭)

매일 단 한 명에게만 "대화 신청"을 보낼 수 있는 앱입니다. 상대가 수락하면 그 날 자정까지 자유롭게 실시간 대화할 수 있습니다.

## 핵심 규칙
- 신청은 **하루 1회만** 가능 (KST 자정 기준 리셋)
- 받은 신청은 여러 개 받을 수 있고, 그 중 원하는 것을 수락
- 수락된 대화방은 **그 날 자정까지만** 활성, 이후 읽기 전용
- 같은 날 동일 상대에게 재신청 불가

## 화면 구성
1. **로그인** (`/auth`) - 이메일/비밀번호 + Google 소셜
2. **홈 — 사람 목록** (`/`) - 공개된 다른 유저 카드 목록, 각자 "대화 신청" 버튼 (오늘 신청 사용 여부 표시)
3. **알림함** (`/inbox`) - 받은 신청 목록, 수락/거절
4. **채팅방** (`/chat/$roomId`) - 실시간 메시지, 자정 카운트다운, 만료 후 입력 비활성화
5. **프로필** (`/profile`) - 닉네임, 한 줄 소개, 아바타

## 데이터 모델
- `profiles` — id (auth.users FK), display_name, bio, avatar_url, is_public
- `conversation_requests` — id, sender_id, receiver_id, status (pending/accepted/declined/expired), request_date (날짜), created_at
  - 유니크: (sender_id, request_date) → 하루 1신청 강제
  - 유니크: (sender_id, receiver_id, request_date) → 같은 날 재신청 방지
- `chat_rooms` — id, request_id, user_a, user_b, active_date, expires_at
- `messages` — id, room_id, sender_id, content, created_at

모든 테이블 RLS + 본인/상대만 접근 가능한 정책.

## 실시간
Supabase Realtime으로 `messages` 테이블 INSERT 구독, 새 신청 알림도 구독.

## 기술적 세부 (개발자용)
- TanStack Start + Supabase (Lovable Cloud)
- 인증: `_authenticated/` 가드 사용 (이미 통합됨)
- 서버 함수(`createServerFn`)로 신청 생성/수락/메시지 전송 — RLS + 서버 측 1일 1회 검증
- Realtime 채널은 클라이언트 `supabase`로 직접 구독
- 자정 만료는 `expires_at` 컬럼으로 클라이언트 체크 + 서버 함수에서도 재검증
- shadcn UI + 깔끔한 미니멀 디자인

## 빌드 순서
1. Lovable Cloud 활성화 + Google OAuth 설정 요청
2. DB 스키마 + RLS 정책 마이그레이션
3. 인증 페이지 + 프로필 자동 생성 트리거
4. 사람 목록 + 신청 보내기
5. 알림함 + 수락/거절
6. 채팅방 + Realtime
7. 자정 만료 처리

진행해도 될까요?