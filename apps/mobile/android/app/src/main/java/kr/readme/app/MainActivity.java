package kr.readme.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    /** 켜지는 중인지(BridgeActivity.load가 켜질 때의 인텐트를 onNewIntent로 한 번 부른다) */
    private boolean launching;
    /** 시스템이 되살린 화면인지(그때의 인텐트는 이미 처리한 공유라 다시 받지 않는다) */
    private boolean restored;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // 다른 앱에서 "공유 → 기억해유"로 온 글을 웹에 넘기는 받은 편지함 플러그인(ShareInboxPlugin)
        registerPlugin(ShareInboxPlugin.class);
        restored = savedInstanceState != null;
        launching = true;
        super.onCreate(savedInstanceState);
        launching = false;
    }

    // 켜질 때의 인텐트(BridgeActivity.load가 부른다)와, 앱이 켜진 채로 온 새 인텐트(singleTask) 모두 여기로 온다
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        if (launching && restored) return;
        ShareInboxPlugin.handleIntent(this, getBridge(), intent);
    }
}
