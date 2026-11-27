package kr.readme.app;

import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.Bridge;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginHandle;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * 다른 앱(삼성 노트·Google Keep·메모 앱 등)의 "공유 → 기억해유"로 넘어온 글을 받아 두는 받은 편지함.
 * 웹(NativeBridge)이 take()로 가져가 메모 쓰는 화면(/voice?shared=1)에 채운다.
 * - take() → { text: string | null }: 받아 둔 글(앞뒤 공백 뺀 것, 최대 20,000자)을 돌려주고 비운다
 * - "shared" 이벤트: 앱이 켜진 채로 새 공유가 들어왔을 때
 * - notesApps() → { apps: [{ id }] }: 메모 쓰기 화면의 '메모 앱에서'가 열 수 있는, 이 휴대폰에 깔린 메모 앱(아래 NOTES_APPS 중)
 * - openApp({ id }) → { opened: boolean }: 그 메모 앱을 연다(사람이 거기서 글을 골라 "공유 → 기억해유"를 누르면 위 길로 돌아온다)
 * 메모 내용은 개인 정보라 주소에 싣거나 로그에 남기지 않는다(메모리에만 잠깐 둔다).
 */
@CapacitorPlugin(name = "ShareInbox")
public class ShareInboxPlugin extends Plugin {

    /** 메모 한 건의 글자 수 상한(웹 쪽 메모칸과 같은 20,000자) */
    static final int MAX_CHARS = 20000;
    /** 텍스트 파일로 공유된 경우 읽을 최대 바이트 */
    static final int MAX_FILE_BYTES = 64 * 1024;

    /**
     * '메모 앱에서'가 열어 줄 메모 앱의 패키지 이름(웹 lib/notes-apps.ts의 ANDROID_NOTES_APPS와, AndroidManifest의 &lt;queries&gt;와 같게 둔다.
     * 안드로이드 11부터는 &lt;queries&gt;에 적은 앱만 깔렸는지 볼 수 있다). 삼성 노트·Keep 메모·네이버 메모·ColorNote·OneNote·Evernote
     */
    static final String[] NOTES_APPS = {
        "com.samsung.android.app.notes",
        "com.google.android.keep",
        "com.nhn.android.navermemo",
        "com.socialnmobile.dictapp.notepad.color.note",
        "com.microsoft.office.onenote",
        "com.evernote",
    };

    private static final Object LOCK = new Object();
    private static String pending;
    /** 파일 읽기는 메인 스레드 밖에서(차례대로). take()가 이 줄 뒤에 서서 읽는 중인 공유를 기다린다 */
    private static final ExecutorService IO = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void take(PluginCall call) {
        // 콜드 스타트에서 파일을 아직 읽는 중일 수 있으니 줄 앞의 일이 끝나길 잠깐 기다린다(최대 2초)
        try {
            IO.submit(() -> {}).get(2, TimeUnit.SECONDS);
        } catch (Exception ignored) {
            // 못 기다려도 지금 있는 것만 돌려준다. 늦게 들어오면 "shared" 이벤트가 다시 알린다
        }
        String text;
        synchronized (LOCK) {
            text = pending;
            pending = null;
        }
        JSObject ret = new JSObject();
        ret.put("text", text == null ? JSObject.NULL : text);
        call.resolve(ret);
    }

    /** 깔려 있어 열 수 있는 메모 앱들(목록 순서대로) */
    @PluginMethod
    public void notesApps(PluginCall call) {
        PackageManager pm = getContext().getPackageManager();
        JSArray apps = new JSArray();
        for (String id : NOTES_APPS) {
            if (pm.getLaunchIntentForPackage(id) == null) continue;
            JSObject app = new JSObject();
            app.put("id", id);
            apps.put(app);
        }
        JSObject ret = new JSObject();
        ret.put("apps", apps);
        call.resolve(ret);
    }

    /** 메모 앱 하나를 연다. 목록에 없는 패키지는 열지 않는다 */
    @PluginMethod
    public void openApp(PluginCall call) {
        String id = call.getString("id");
        boolean known = false;
        for (String app : NOTES_APPS) {
            if (app.equals(id)) known = true;
        }
        boolean opened = false;
        if (known) {
            Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(id);
            if (intent != null) {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try {
                    getContext().startActivity(intent);
                    opened = true;
                } catch (Exception ignored) {
                    // 열지 못하면 opened=false로 알린다
                }
            }
        }
        JSObject ret = new JSObject();
        ret.put("opened", opened);
        call.resolve(ret);
    }

    /**
     * 들어온 인텐트가 텍스트 공유면 글을 받아 두고 "shared"를 알린다. 아니면 아무것도 하지 않는다.
     * MainActivity가 켜질 때(BridgeActivity.load가 onNewIntent로 부른다)와 새 인텐트가 올 때 부른다. 어느 스레드에서 불러도 된다.
     */
    static void handleIntent(Context context, Bridge bridge, Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) return;
        String type = intent.getType();
        if (type == null || !type.startsWith("text/")) return;
        // 최근 앱 목록에서 다시 열린 인텐트는 이미 처리한 공유다
        if ((intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0) return;

        final Context app = context.getApplicationContext();
        String text = clean(textFromExtras(intent));
        if (text != null) {
            store(bridge, text);
            return;
        }
        // 글이 아니라 텍스트 파일로 온 경우(삼성 노트 "텍스트 파일" 공유): 파일을 읽는다
        final Uri uri = streamUri(intent);
        if (uri == null) return;
        IO.execute(() -> {
            String fromFile = clean(readTextFile(app, uri));
            if (fromFile != null) store(bridge, fromFile);
        });
    }

    private static void store(Bridge bridge, String text) {
        synchronized (LOCK) {
            pending = text;
        }
        // 앱이 켜져 있으면 웹에 알린다(콜드 스타트면 웹이 뜰 때 take()로 가져간다)
        if (bridge == null) return;
        PluginHandle handle = bridge.getPlugin("ShareInbox");
        if (handle == null) return;
        final Plugin plugin = handle.getInstance();
        if (!(plugin instanceof ShareInboxPlugin)) return;
        new Handler(Looper.getMainLooper()).post(() -> ((ShareInboxPlugin) plugin).notifyListeners("shared", new JSObject()));
    }

    /** EXTRA_TEXT(글) 앞에 제목(EXTRA_SUBJECT)을 한 줄로 붙인다. 글에 이미 들어 있으면 붙이지 않는다 */
    private static String textFromExtras(Intent intent) {
        CharSequence body = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        CharSequence subject = intent.getCharSequenceExtra(Intent.EXTRA_SUBJECT);
        String text = body == null ? "" : body.toString();
        String title = subject == null ? "" : subject.toString().trim();
        if (text.trim().isEmpty()) return null;
        if (!title.isEmpty() && !text.contains(title)) return title + "\n" + text;
        return text;
    }

    @SuppressWarnings("deprecation")
    private static Uri streamUri(Intent intent) {
        try {
            if (Build.VERSION.SDK_INT >= 33) return intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            Object stream = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            return stream instanceof Uri ? (Uri) stream : null;
        } catch (Exception e) {
            return null;
        }
    }

    /** 텍스트 파일을 UTF-8(BOM이 있으면 UTF-16도)로 최대 64KB까지 읽는다. 글이 아닌 파일(0 바이트가 섞인 것)은 버린다 */
    private static String readTextFile(Context context, Uri uri) {
        ContentResolver resolver = context.getContentResolver();
        String mime = null;
        try {
            mime = resolver.getType(uri);
        } catch (Exception ignored) {
            // 모르면 내용으로 가린다
        }
        if (mime != null && !mime.startsWith("text/") && !"application/octet-stream".equals(mime)) return null;
        try (InputStream in = resolver.openInputStream(uri)) {
            if (in == null) return null;
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int total = 0;
            boolean truncated = false;
            while (true) {
                int n = in.read(buf, 0, Math.min(buf.length, MAX_FILE_BYTES - total));
                if (n < 0) break;
                out.write(buf, 0, n);
                total += n;
                if (total >= MAX_FILE_BYTES) {
                    truncated = in.read() >= 0;
                    break;
                }
            }
            byte[] bytes = out.toByteArray();
            Charset charset = StandardCharsets.UTF_8;
            int offset = 0;
            if (bytes.length >= 3 && (bytes[0] & 0xFF) == 0xEF && (bytes[1] & 0xFF) == 0xBB && (bytes[2] & 0xFF) == 0xBF) {
                offset = 3;
            } else if (bytes.length >= 2 && (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xFE) {
                charset = StandardCharsets.UTF_16LE;
                offset = 2;
            } else if (bytes.length >= 2 && (bytes[0] & 0xFF) == 0xFE && (bytes[1] & 0xFF) == 0xFF) {
                charset = StandardCharsets.UTF_16BE;
                offset = 2;
            }
            if (charset == StandardCharsets.UTF_8) {
                for (int i = offset; i < bytes.length; i++) {
                    if (bytes[i] == 0) return null;
                }
            }
            String s = new String(bytes, offset, bytes.length - offset, charset);
            // 64KB에서 잘렸다면 끝의 깨진 글자 하나를 뗀다
            if (truncated && s.endsWith("�")) s = s.substring(0, s.length() - 1);
            return s;
        } catch (Exception e) {
            return null;
        }
    }

    /** 앞뒤 공백을 떼고 20,000자로 자른다. 비면 null */
    private static String clean(String s) {
        if (s == null) return null;
        String t = s.trim();
        if (t.isEmpty()) return null;
        if (t.length() > MAX_CHARS) {
            int end = MAX_CHARS;
            // 서로게이트 쌍(이모지 등) 가운데서 자르지 않는다
            if (Character.isHighSurrogate(t.charAt(end - 1))) end--;
            t = t.substring(0, end).trim();
        }
        return t.isEmpty() ? null : t;
    }
}
