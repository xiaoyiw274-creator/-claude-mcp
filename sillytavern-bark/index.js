import { eventSource, event_types, chat, name2, saveSettingsDebounced } from "../../../../script.js";
import { extension_settings } from "../../../extensions.js";

const EXT_ID = "sillytavern-bark";
const DEFAULTS = {
    enabled: true,
    bark_key: "",
    only_when_unfocused: true,
    preview_length: 30,
    server_base: "https://api.day.app",
};

if (!extension_settings[EXT_ID]) extension_settings[EXT_ID] = {};
const settings = Object.assign({}, DEFAULTS, extension_settings[EXT_ID]);
extension_settings[EXT_ID] = settings;

let last_pushed_index = -1;

function cleanText(s) {
    return (s || "")
        .replace(/```[\s\S]*?```/g, "")
        .replace(/<[^>]+>/g, "")
        .replace(/[*_`~]+/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function pushBark(title, body) {
    const key = (settings.bark_key || "").trim();
    if (!key) return false;
    const base = (settings.server_base || "https://api.day.app").replace(/\/+$/, "");
    const t = encodeURIComponent(title || "SillyTavern");
    const b = encodeURIComponent(body || "");
    const url = `${base}/${key}/${t}/${b}`;
    fetch(url, { mode: "no-cors" }).catch(() => {});
    console.log("[Bark] pushed:", title, "|", body);
    return true;
}

async function onGenerationEnded() {
    if (!settings.enabled || !settings.bark_key) return;
    if (settings.only_when_unfocused && document.hasFocus()) return;

    // 等一拍, 让 chat[] 把最新消息塞进去
    await new Promise(r => setTimeout(r, 80));

    const idx = chat.length - 1;
    if (idx < 0 || idx === last_pushed_index) return;
    const m = chat[idx];
    if (!m || m.is_user) return;

    last_pushed_index = idx;
    const title = m.name || name2 || "SillyTavern";
    const body = cleanText(m.mes).slice(0, settings.preview_length || 30) || "(空)";
    pushBark(title, body);
}

eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);

function buildUI() {
    const html = `
    <div id="bark_notify_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>📱 Bark 推送</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label class="checkbox_label">
                    <input id="bark_enabled" type="checkbox" />
                    <span>启用</span>
                </label>
                <label class="checkbox_label">
                    <input id="bark_only_unfocused" type="checkbox" />
                    <span>仅在 ST 标签页不在前台时推送</span>
                </label>
                <label for="bark_key">Bark Key</label>
                <input id="bark_key" type="password" class="text_pole" placeholder="iPhone Bark app 首页复制" />
                <label for="bark_server">服务端 (自建可改)</label>
                <input id="bark_server" type="text" class="text_pole" placeholder="https://api.day.app" />
                <label for="bark_preview_length">预览长度</label>
                <input id="bark_preview_length" type="number" min="10" max="200" class="text_pole" />
                <div style="margin-top:8px">
                    <input id="bark_test" type="button" class="menu_button" value="测试推送" />
                    <span id="bark_test_result" style="margin-left:8px"></span>
                </div>
                <small style="display:block;margin-top:10px;opacity:0.7">
                    监听 GENERATION_ENDED 事件,生成完成往 Bark 发一条。CORS 用 no-cors 绕过,推送照常到手机。
                </small>
            </div>
        </div>
    </div>`;
    $("#extensions_settings2").append(html);

    $("#bark_enabled").prop("checked", settings.enabled).on("change", function () {
        settings.enabled = $(this).prop("checked");
        saveSettingsDebounced();
    });
    $("#bark_only_unfocused").prop("checked", settings.only_when_unfocused).on("change", function () {
        settings.only_when_unfocused = $(this).prop("checked");
        saveSettingsDebounced();
    });
    $("#bark_key").val(settings.bark_key).on("input", function () {
        settings.bark_key = $(this).val();
        saveSettingsDebounced();
    });
    $("#bark_server").val(settings.server_base).on("input", function () {
        settings.server_base = $(this).val() || "https://api.day.app";
        saveSettingsDebounced();
    });
    $("#bark_preview_length").val(settings.preview_length).on("input", function () {
        const v = parseInt($(this).val(), 10);
        settings.preview_length = isNaN(v) ? 30 : Math.max(10, Math.min(200, v));
        saveSettingsDebounced();
    });
    $("#bark_test").on("click", function () {
        const r = $("#bark_test_result");
        if (!settings.bark_key) {
            r.text("先填 Bark Key").css("color", "salmon");
            return;
        }
        pushBark("SillyTavern 测试", "Bark 通道已联通 ✓");
        r.text("已发, 看手机").css("color", "lightgreen");
        setTimeout(() => r.text(""), 5000);
    });
}

jQuery(() => {
    buildUI();
    console.log(`[Bark] extension loaded (enabled=${settings.enabled}, key=${settings.bark_key ? "set" : "empty"})`);
});
