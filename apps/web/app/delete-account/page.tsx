import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";
import { legalLocale, SUPPORT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = { title: "계정 삭제 · Delete Account" };

// Google Play '계정 삭제 URL'로 등록하는 페이지: 앱 안에서 지우는 법, 앱 없이 요청하는 법, 일부만 지우는 법(#partial, 데이터 삭제 URL), 지워지는 것과 남는 것
export default async function DeleteAccount({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const locale = await legalLocale((await searchParams).lang);
  const mail = <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(locale === "ko" ? "기억해유 계정 삭제 요청" : "Remember You account deletion")}`}>{SUPPORT_EMAIL}</a>;
  if (locale === "en") {
    return (
      <LegalPage locale="en" path="/delete-account" title="Delete your Remember You account">
        <h2>In the app</h2>
        <ol>
          <li>Open Remember You and sign in.</li>
          <li>
            Go to the <b>Settings</b> tab and scroll to the bottom.
          </li>
          <li>
            Tap <b>Delete account</b>, then <b>Delete everything</b>.
          </li>
        </ol>

        <h2>Without the app</h2>
        <p>
          Email {mail} from the email address of your Google or Apple account with the subject &ldquo;Remember You account deletion&rdquo;. We delete the account within 7 days and reply when it&rsquo;s done.
        </p>

        <h2 id="partial">Delete some data and keep your account</h2>
        <ul>
          <li>
            <b>About me</b>: open an item to clear it, or remove wishlist items and dates one by one.
          </li>
          <li>
            <b>People</b>: open a person, tap a note in <b>Notebook</b>, then tap <b>Delete</b> (you can also remove what that note added to what you remember).
          </li>
          <li>
            On the same screen, tap <b>···</b> at the top right and tap <b>Delete</b> to delete that person with their notebook, what you remember and question links.
          </li>
          <li>
            <b>Settings</b>: tap <b>Cancel</b> next to a question link nobody has answered yet.
          </li>
        </ul>
        <p>These take effect right away, and database backups roll off within 7 days. To delete something specific without the app, email {mail}.</p>

        <h2>What gets deleted with your account</h2>
        <ul>
          <li>Your account and sign-in information</li>
          <li>About me (favorites, allergies, sizes, gifts, dates) and avatar</li>
          <li>Your people and your records about them, private notes, question links, notifications and settings</li>
        </ul>
        <p>Deletion is immediate and can&rsquo;t be undone. Database backups roll off within 7 days.</p>

        <h2>What stays</h2>
        <p>
          Nothing about you stays with us. If you answered someone&rsquo;s questions, those answers stay in the asker&rsquo;s record; ask them or email us to have them removed.
        </p>
      </LegalPage>
    );
  }
  return (
    <LegalPage locale="ko" path="/delete-account" title="기억해유 계정 삭제">
      <h2>앱에서 지우기</h2>
      <ol>
        <li>기억해유를 열고 로그인합니다.</li>
        <li>
          아래 <b>설정</b> 탭을 열고 맨 아래로 내립니다.
        </li>
        <li>
          <b>계정 삭제</b>를 누르고 <b>모두 지우기</b>를 누릅니다.
        </li>
      </ol>

      <h2>앱 없이 요청하기</h2>
      <p>가입한 Google·Apple 계정의 이메일로 {mail}에 &lsquo;기억해유 계정 삭제 요청&rsquo;이라고 보내 주세요. 7일 안에 지우고 끝나면 답장합니다.</p>

      <h2 id="partial">계정은 두고 일부만 지우기</h2>
      <ul>
        <li>
          <b>나에 대한 기록</b>: 항목을 열어 내용을 비우거나, 위시리스트와 기념일을 하나씩 지웁니다.
        </li>
        <li>
          <b>사람들</b>: 사람을 열고 <b>메모장</b>에서 메모를 눌러 <b>지우기</b>를 누르면 그 메모가 지워집니다(그 메모로 기억해 둔 것에 더해진 내용도 같이 지울 수 있습니다).
        </li>
        <li>
          같은 화면 오른쪽 위 <b>···</b>를 눌러 <b>지우기</b>를 누르면 그 사람과 그 사람의 메모장·기억해 둔 것·물어보기 링크가 모두 지워집니다.
        </li>
        <li>
          <b>설정</b>: 아직 아무도 답하지 않은 물어보기 링크 옆 <b>취소</b>를 누르면 링크가 더는 열리지 않습니다.
        </li>
      </ul>
      <p>바로 지워지며 데이터베이스 백업에서도 7일 안에 사라집니다. 앱 없이 특정 정보만 지우고 싶으면 {mail}로 알려 주세요.</p>

      <h2>계정을 지우면 지워지는 것</h2>
      <ul>
        <li>계정과 로그인 정보</li>
        <li>나에 대한 기록(취향, 알레르기, 사이즈, 선물, 기념일)와 아바타</li>
        <li>내 사람들과 그 사람들의 기억해 둔 것, 메모장, 물어보기 링크, 알림, 설정</li>
      </ul>
      <p>바로 지워지며 되돌릴 수 없습니다. 데이터베이스 백업에서도 7일 안에 사라집니다.</p>

      <h2>남는 것</h2>
      <p>운영자에게 남는 내 정보는 없습니다. 다른 사람이 물어본 것에 답했다면 그 답은 물어본 사람의 기록에 남으니, 지우고 싶으면 그 사람에게 말하거나 메일로 알려 주세요.</p>
    </LegalPage>
  );
}
