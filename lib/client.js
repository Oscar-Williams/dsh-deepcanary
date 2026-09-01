window.__ModuleLoader__.load({
  id: "dsh-deepcanary",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
  "use strict";
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // src/client/index.ts
  var client_exports = {};
  __export(client_exports, {
    apply: () => apply,
    inject: () => inject
  });
  module.exports = __toCommonJS(client_exports);
  var import_react = require("react");

  // src/client/attention-navigation.ts
  function positionSelectedAttention(elements, id) {
    const selected = [...elements].find((element) => element.dataset.deepcanaryItem === id);
    if (selected === void 0) return false;
    selected.scrollIntoView({ block: "nearest", inline: "nearest" });
    return true;
  }
  function handleNotificationClick(notification, id, open, focus) {
    focus();
    open(id);
    notification.close();
  }

  // src/client/index.ts
  var NS = "deepcanary";
  var SETTINGS_NS = "dsh-deepcanary";
  var STYLE_ID = "dsh-deepcanary-client-style";
  var SIZE_KEY = "dsh-deepcanary-ui";
  var SEEN_KEY = "dsh-deepcanary-notified";
  var AUTO_OPEN_KEY = "dsh-deepcanary-auto-opened";
  var MIN_WIDTH = 320;
  var MAX_WIDTH = 640;
  var MIN_HEIGHT = 320;
  var MAX_HEIGHT = 720;
  var AUTO_OPEN_REASONS = /* @__PURE__ */ new Set(["HOST_UNREACHABLE", "SUBAGENT_PRESSURE"]);
  var zh = {
    "trigger.open": "\u6253\u5F00 DeepCanary",
    "trigger.close": "\u5173\u95ED DeepCanary",
    "trigger.label": "DeepCanary \u6CE8\u610F\u529B\u63D0\u9192",
    "trigger.count": "{count} \u6761\u5F85\u5904\u7406\u63D0\u9192",
    "panel.title": "DeepCanary",
    "panel.subtitle": "\u672C\u5730\u6CE8\u610F\u529B\u76D1\u7763",
    "panel.status.ready": "\u8FD0\u884C\u6B63\u5E38",
    "panel.status.loading": "\u52A0\u8F7D\u4E2D",
    "panel.status.offline": "\u6682\u65F6\u65E0\u6CD5\u540C\u6B65",
    "panel.close": "\u5173\u95ED\u9762\u677F",
    "panel.refresh": "\u5237\u65B0\u72B6\u6001",
    "panel.refreshing": "\u6B63\u5728\u5237\u65B0",
    "panel.empty": "\u76EE\u524D\u6CA1\u6709\u5F85\u5904\u7406\u63D0\u9192",
    "panel.emptyHint": "\u65B0\u7684\u6CE8\u610F\u529B\u4E8B\u4EF6\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002",
    "panel.sessions": "{count} \u4E2A\u6D3B\u52A8\u4F1A\u8BDD",
    "panel.notification.enable": "\u542F\u7528\u6D4F\u89C8\u5668\u901A\u77E5",
    "panel.notification.enabled": "\u6D4F\u89C8\u5668\u901A\u77E5\u5DF2\u542F\u7528",
    "panel.notification.unavailable": "\u5F53\u524D\u6D4F\u89C8\u5668\u4E0D\u652F\u6301\u901A\u77E5",
    "panel.settings": "\u63D0\u9192\u8BBE\u7F6E",
    "panel.settingsHint": "\u8BF7\u5728 DSH \u8BBE\u7F6E > Plugins \u4E2D\u8C03\u6574\u63D0\u9192\u7B56\u7565\uFF1B\u8FD9\u91CC\u4E0D\u91CD\u590D\u5D4C\u5165\u5B8C\u6574\u8BBE\u7F6E\u8868\u5355\u3002",
    "panel.settingsLocation": "\u8BBE\u7F6E\u4F4D\u7F6E\uFF1ADSH \u8BBE\u7F6E > Plugins",
    "panel.bodyLabel": "DeepCanary \u5F85\u5904\u7406\u63D0\u9192",
    "panel.updateRequired": "DeepCanary \u72B6\u6001\u534F\u8BAE\u9700\u8981\u66F4\u65B0\u63D2\u4EF6\u3002",
    "panel.lastSynced": "\u6700\u8FD1\u540C\u6B65\uFF1A{time}",
    "panel.save": "\u4FDD\u5B58\u8BBE\u7F6E",
    "panel.saved": "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58",
    "panel.settings.notificationLevel": "\u63D0\u9192\u7EA7\u522B",
    "panel.settings.maxInterrupts": "\u6BCF\u5C0F\u65F6\u6700\u591A\u6253\u65AD",
    "panel.settings.longRun": "\u505C\u6EDE\u9608\u503C\uFF08\u5206\u949F\uFF09",
    "panel.settings.bundle": "\u76F8\u90BB\u4E8B\u4EF6\u5408\u5E76\uFF08\u79D2\uFF09",
    "panel.settings.subagent": "Subagent \u538B\u529B",
    "panel.settings.subagent.relaxed": "\u5BBD\u677E",
    "panel.settings.subagent.standard": "\u6807\u51C6",
    "panel.settings.subagent.strict": "\u4E25\u683C",
    "panel.settings.quiet": "\u9759\u9ED8\u65F6\u6BB5",
    "panel.settings.quietEnable": "\u542F\u7528\u9759\u9ED8\u65F6\u6BB5",
    "panel.settings.quietStart": "\u5F00\u59CB",
    "panel.settings.quietEnd": "\u7ED3\u675F",
    "panel.settings.privacy": "\u4EC5\u4F7F\u7528\u9690\u79C1\u5B89\u5168\u6458\u8981",
    "panel.resize.width": "\u8C03\u6574\u9762\u677F\u5BBD\u5EA6",
    "panel.resize.height": "\u8C03\u6574\u9762\u677F\u9AD8\u5EA6",
    "settings.title": "DeepCanary \u63D0\u9192\u7B56\u7565",
    "settings.description": "\u63A7\u5236\u63D0\u9192\u7EA7\u522B\u3001\u8282\u6D41\u7B56\u7565\u548C\u6CE8\u610F\u529B\u76D1\u7763\u8303\u56F4\u3002",
    "settings.hint": "\u8BBE\u7F6E\u5199\u5165 DSH \u7684 dsh-deepcanary \u547D\u540D\u7A7A\u95F4\uFF0C\u4E0D\u4F1A\u4FEE\u6539\u4F1A\u8BDD\u5185\u5BB9\u3002",
    "settings.unsaved": "\u672A\u4FDD\u5B58",
    "settings.readOnly": "\u5F53\u524D\u8BBE\u7F6E\u6E90\u4E3A\u53EA\u8BFB\uFF1B\u8BF7\u5728\u53EF\u5199\u7684 DSH \u914D\u7F6E\u73AF\u5883\u4E2D\u4FEE\u6539\u3002",
    "settings.save": "\u4FDD\u5B58",
    "settings.saving": "\u4FDD\u5B58\u4E2D",
    "settings.discard": "\u653E\u5F03\u4FEE\u6539",
    "settings.reset": "\u6062\u590D\u9ED8\u8BA4",
    "settings.saveFailed": "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8FDE\u63A5\u540E\u91CD\u8BD5\u3002",
    "settings.conflict": "\u8BBE\u7F6E\u5DF2\u88AB\u5176\u4ED6\u7A97\u53E3\u4FEE\u6539\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u540E\u518D\u4FDD\u5B58\u3002",
    "settings.level": "\u6700\u4F4E\u63D0\u9192\u7EA7\u522B",
    "settings.openOnCritical": "\u9047\u5230\u5141\u8BB8\u5217\u8868\u4E2D\u7684 C3 \u4E8B\u4EF6\u65F6\u81EA\u52A8\u5524\u8D77\u9762\u677F",
    "settings.maxInterrupts": "\u6BCF\u5C0F\u65F6\u6700\u591A\u6253\u65AD\u6B21\u6570",
    "settings.dedupe": "\u7B49\u4EF7\u4E8B\u4EF6\u53BB\u91CD\u7A97\u53E3\uFF08\u5206\u949F\uFF09",
    "settings.bundle": "\u76F8\u90BB\u4E8B\u4EF6\u5408\u5E76\u7A97\u53E3\uFF08\u79D2\uFF09",
    "settings.longRun": "\u505C\u6EDE\u68C0\u67E5\u9608\u503C\uFF08\u5206\u949F\uFF09",
    "settings.subagent": "Subagent \u538B\u529B\u7B56\u7565",
    "settings.subagent.relaxed": "\u5BBD\u677E",
    "settings.subagent.standard": "\u6807\u51C6",
    "settings.subagent.strict": "\u4E25\u683C",
    "settings.quiet": "\u9759\u9ED8\u65F6\u6BB5",
    "settings.quietEnable": "\u542F\u7528\u9759\u9ED8\u65F6\u6BB5",
    "settings.quietStart": "\u5F00\u59CB\u65F6\u95F4",
    "settings.quietEnd": "\u7ED3\u675F\u65F6\u95F4",
    "settings.privacy": "\u4EC5\u4F7F\u7528\u9690\u79C1\u5B89\u5168\u6458\u8981",
    "settings.healthPoll": "Host \u5065\u5EB7\u68C0\u67E5\u95F4\u9694\uFF08\u79D2\uFF09",
    "settings.maxInbox": "\u6700\u591A\u4FDD\u7559\u7684 Inbox \u6761\u76EE",
    "item.reason.HUMAN_APPROVAL_REQUIRED": "DSH \u6B63\u5728\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6279\u3002",
    "item.reason.HUMAN_QUESTION_PENDING": "DSH \u6B63\u5728\u7B49\u5F85\u4F60\u7684\u56DE\u7B54\u3002",
    "item.reason.HOST_UNREACHABLE": "DSH \u4E3B\u673A\u6682\u65F6\u65E0\u6CD5\u8BBF\u95EE\u3002",
    "item.reason.HOST_SUSPECTED_STALL": "\u4F1A\u8BDD\u53EF\u80FD\u5DF2\u957F\u65F6\u95F4\u6CA1\u6709\u8FDB\u5C55\u3002",
    "item.reason.TOOL_FAILURE_LOOP": "\u540C\u4E00\u5DE5\u5177\u8FDE\u7EED\u8FD4\u56DE\u5931\u8D25\u7ED3\u679C\u3002",
    "item.reason.NO_MEANINGFUL_PROGRESS": "\u4F1A\u8BDD\u6301\u7EED\u8FD0\u884C\uFF0C\u4F46\u6682\u672A\u89C2\u5BDF\u5230\u6709\u6548\u8FDB\u5C55\u3002",
    "item.reason.SUBAGENT_PRESSURE": "\u6D3B\u52A8 Subagent \u6570\u91CF\u5DF2\u8FBE\u5230\u538B\u529B\u9608\u503C\u3002",
    "item.reason.CONTEXT_PRESSURE": "\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u538B\u529B\u9700\u8981\u5173\u6CE8\u3002",
    "item.reason.COMPACTION_OCCURRED": "DSH \u5DF2\u6267\u884C\u4E00\u6B21\u4E0A\u4E0B\u6587\u538B\u7F29\u3002",
    "item.reason.TASK_COMPLETED": "\u4F1A\u8BDD\u62A5\u544A\u4E86\u4E00\u6B21\u6B63\u5E38\u5B8C\u6210\u3002",
    "item.reason.TASK_FAILED": "\u4F1A\u8BDD\u62A5\u544A\u6267\u884C\u5931\u8D25\u3002",
    "item.reason.TASK_ABORTED": "\u4F1A\u8BDD\u88AB\u4E2D\u6B62\uFF0C\u53EF\u80FD\u9700\u8981\u786E\u8BA4\u662F\u5426\u7EE7\u7EED\u3002",
    "item.reason.COMPLETION_SUSPICIOUS": "\u4EFB\u52A1\u770B\u4F3C\u5B8C\u6210\uFF0C\u4F46\u6700\u7EC8\u8BC1\u636E\u4ECD\u503C\u5F97\u68C0\u67E5\u3002",
    "item.reason.HOST_STALL_RECOVERED": "\u4F1A\u8BDD\u5DF2\u91CD\u65B0\u4EA7\u751F\u4E8B\u4EF6\u3002",
    "item.reason.unknown": "\u68C0\u6D4B\u5230\u9700\u8981\u5173\u6CE8\u7684\u8FD0\u884C\u65F6\u4E8B\u4EF6\u3002",
    "item.suggestion.HUMAN_APPROVAL_REQUIRED": "\u5728 DSH \u4E2D\u67E5\u770B\u5F85\u5BA1\u6279\u8BF7\u6C42\u5E76\u51B3\u5B9A\u662F\u5426\u5141\u8BB8\u3002",
    "item.suggestion.HUMAN_QUESTION_PENDING": "\u51C6\u5907\u597D\u540E\uFF0C\u5728 DSH \u4E2D\u56DE\u7B54\u5F85\u5904\u7406\u95EE\u9898\u3002",
    "item.suggestion.HOST_UNREACHABLE": "\u68C0\u67E5 DSH \u4E3B\u673A\u548C\u6D4F\u89C8\u5668\u8FDE\u63A5\u3002",
    "item.suggestion.HOST_SUSPECTED_STALL": "\u68C0\u67E5\u4F1A\u8BDD\uFF0C\u518D\u51B3\u5B9A\u7EE7\u7EED\u8FD8\u662F\u505C\u6B62\u3002",
    "item.suggestion.TOOL_FAILURE_LOOP": "\u68C0\u67E5\u91CD\u590D\u5931\u8D25\u7684\u5DE5\u5177\u8C03\u7528\u548C\u8FD0\u884C\u73AF\u5883\u3002",
    "item.suggestion.NO_MEANINGFUL_PROGRESS": "\u67E5\u770B\u4F1A\u8BDD\u72B6\u6001\uFF0C\u51B3\u5B9A\u662F\u5426\u9700\u8981\u8C03\u6574\u4EFB\u52A1\u3002",
    "item.suggestion.SUBAGENT_PRESSURE": "\u68C0\u67E5\u6D3B\u52A8 Subagent \u53CA\u5176\u9884\u7B97\uFF1B\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u53D6\u6D88\u3002",
    "item.suggestion.CONTEXT_PRESSURE": "\u68C0\u67E5\u4E0A\u4E0B\u6587\u72B6\u6001\uFF0C\u8003\u8651\u4F7F\u7528\u66F4\u7CBE\u7B80\u7684\u7EED\u63A5\u3002",
    "item.suggestion.COMPACTION_OCCURRED": "\u68C0\u67E5\u538B\u7F29\u540E\u7684\u4F1A\u8BDD\u4E0A\u4E0B\u6587\u662F\u5426\u4ECD\u7136\u5B8C\u6574\u3002",
    "item.suggestion.TASK_FAILED": "\u68C0\u67E5\u5931\u8D25\u8BC1\u636E\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u91CD\u8BD5\u3002",
    "item.suggestion.TASK_ABORTED": "\u786E\u8BA4\u662F\u5426\u9700\u8981\u6062\u590D\u5DF2\u4E2D\u6B62\u7684\u4EFB\u52A1\u3002",
    "item.suggestion.COMPLETION_SUSPICIOUS": "\u63A5\u53D7\u5B8C\u6210\u7ED3\u679C\u524D\u68C0\u67E5\u6700\u7EC8\u8BC1\u636E\u3002",
    "item.suggestion.HOST_STALL_RECOVERED": "\u5982\u6062\u590D\u5E76\u975E\u9884\u671F\uFF0C\u8BF7\u68C0\u67E5\u8BE5\u4F1A\u8BDD\u3002",
    "item.suggestion.unknown": "\u67E5\u770B\u6536\u4EF6\u7BB1\u4E2D\u7684\u8BC1\u636E\u540E\u51B3\u5B9A\u4E0B\u4E00\u6B65\u3002",
    "item.level": "\u6CE8\u610F\u529B\u7EA7\u522B {level}",
    "item.events": "{count} \u4E2A\u76F8\u5173\u4E8B\u4EF6",
    "item.suggestion": "\u5EFA\u8BAE\uFF1A{text}",
    "item.evidence": "\u67E5\u770B\u6280\u672F\u8BC1\u636E",
    "item.evidenceLine": "{type} \xB7 {authority}",
    "item.evidence.session": "\u4F1A\u8BDD\u4E8B\u4EF6",
    "item.evidence.runtime": "\u8FD0\u884C\u65F6\u63A2\u9488",
    "item.evidence.tool": "\u5DE5\u5177\u8BB0\u5F55",
    "item.evidence.subagent": "Subagent \u72B6\u6001",
    "item.evidence.http": "HTTP \u63A2\u9488",
    "item.authority.host": "\u4E3B\u673A",
    "item.authority.runtime": "\u8FD0\u884C\u65F6",
    "item.authority.derived": "\u6D3E\u751F",
    "item.authority.heuristic": "\u542F\u53D1\u5F0F",
    "item.technicalDetail": "\u4F9D\u636E\uFF1A{text}",
    "item.policyTrace": "\u67E5\u770B\u51B3\u7B56\u8F68\u8FF9",
    "item.policyVersion": "\u7B56\u7565\u7248\u672C\uFF1A{version}",
    "item.matchedRules": "\u547D\u4E2D\u89C4\u5219\uFF1A{rules}",
    "item.appliedScopes": "\u751F\u6548\u8303\u56F4\uFF1A{scopes}",
    "item.suppressedBy": "\u6291\u5236\u56E0\u7D20\uFF1A{values}",
    "item.authoritySummary": "\u8BC1\u636E\u6743\u5A01\uFF1A{text}",
    "item.finalDecision": "\u6700\u7EC8\u5224\u5B9A\uFF1A{level} / {action}",
    "item.bundled": "Bundle \u805A\u5408\uFF1A{count} \u4E2A\u4E8B\u4EF6",
    "item.recoveryRule": "\u6062\u590D\u89C4\u5219\uFF1A{rule}",
    "item.none": "\u65E0",
    "item.acknowledge": "\u5DF2\u5904\u7406",
    "item.snooze": "\u7A0D\u540E\u63D0\u9192",
    "item.mute": "\u9759\u97F3",
    "item.useful": "\u6709\u7528",
    "item.irrelevant": "\u4E0D\u76F8\u5173",
    "item.jump": "\u8DF3\u8F6C\u5230 DSH",
    "item.unknownReason": "\u672A\u77E5\u539F\u56E0\u7801\uFF1A{code}",
    "state.failed": "\u6682\u65F6\u65E0\u6CD5\u8BFB\u53D6 DeepCanary \u72B6\u6001\u3002",
    "state.retry": "\u91CD\u8BD5",
    "common.yes": "\u662F",
    "common.no": "\u5426"
  };
  var en = {
    "trigger.open": "Open DeepCanary",
    "trigger.close": "Close DeepCanary",
    "trigger.label": "DeepCanary attention alerts",
    "trigger.count": "{count} pending alerts",
    "panel.title": "DeepCanary",
    "panel.subtitle": "Local attention supervision",
    "panel.status.ready": "Running normally",
    "panel.status.loading": "Loading",
    "panel.status.offline": "Sync temporarily unavailable",
    "panel.close": "Close panel",
    "panel.refresh": "Refresh status",
    "panel.refreshing": "Refreshing",
    "panel.empty": "There are no pending alerts",
    "panel.emptyHint": "New attention events will appear here.",
    "panel.sessions": "{count} active sessions",
    "panel.notification.enable": "Enable browser notifications",
    "panel.notification.enabled": "Browser notifications enabled",
    "panel.notification.unavailable": "Notifications are not supported by this browser",
    "panel.settings": "Alert settings",
    "panel.settingsHint": "Adjust alert policy in DSH Settings > Plugins; the full form is not duplicated in this panel.",
    "panel.settingsLocation": "Settings: DSH Settings > Plugins",
    "panel.bodyLabel": "DeepCanary pending alerts",
    "panel.updateRequired": "The DeepCanary state protocol requires a newer plugin.",
    "panel.lastSynced": "Last sync: {time}",
    "panel.save": "Save settings",
    "panel.saved": "Settings saved",
    "panel.settings.notificationLevel": "Alert level",
    "panel.settings.maxInterrupts": "Maximum interrupts per hour",
    "panel.settings.longRun": "Stall threshold (minutes)",
    "panel.settings.bundle": "Adjacent-event bundle window (seconds)",
    "panel.settings.subagent": "Subagent pressure",
    "panel.settings.subagent.relaxed": "Relaxed",
    "panel.settings.subagent.standard": "Standard",
    "panel.settings.subagent.strict": "Strict",
    "panel.settings.quiet": "Quiet hours",
    "panel.settings.quietEnable": "Enable quiet hours",
    "panel.settings.quietStart": "Start",
    "panel.settings.quietEnd": "End",
    "panel.settings.privacy": "Use privacy-safe summaries only",
    "panel.resize.width": "Resize panel width",
    "panel.resize.height": "Resize panel height",
    "settings.title": "DeepCanary alert policy",
    "settings.description": "Control alert levels, throttling, and attention supervision scope.",
    "settings.hint": "Settings are written to DSH namespace dsh-deepcanary and never modify session content.",
    "settings.unsaved": "Unsaved",
    "settings.readOnly": "The current settings source is read-only; use a writable DSH configuration to edit it.",
    "settings.save": "Save",
    "settings.saving": "Saving",
    "settings.discard": "Discard changes",
    "settings.reset": "Reset to defaults",
    "settings.saveFailed": "Save failed. Check the connection and try again.",
    "settings.conflict": "Settings changed in another window. Reload them before saving.",
    "settings.level": "Minimum alert level",
    "settings.openOnCritical": "Open the panel automatically for allowlisted C3 events",
    "settings.maxInterrupts": "Maximum interrupts per hour",
    "settings.dedupe": "Equivalent-event dedupe window (minutes)",
    "settings.bundle": "Adjacent-event bundle window (seconds)",
    "settings.longRun": "Stall-check threshold (minutes)",
    "settings.subagent": "Subagent pressure policy",
    "settings.subagent.relaxed": "Relaxed",
    "settings.subagent.standard": "Standard",
    "settings.subagent.strict": "Strict",
    "settings.quiet": "Quiet hours",
    "settings.quietEnable": "Enable quiet hours",
    "settings.quietStart": "Start time",
    "settings.quietEnd": "End time",
    "settings.privacy": "Use privacy-safe summaries only",
    "settings.healthPoll": "Host health-check interval (seconds)",
    "settings.maxInbox": "Maximum retained Inbox items",
    "item.reason.HUMAN_APPROVAL_REQUIRED": "DSH is waiting for human approval.",
    "item.reason.HUMAN_QUESTION_PENDING": "DSH is waiting for your answer.",
    "item.reason.HOST_UNREACHABLE": "The DSH host is temporarily unreachable.",
    "item.reason.HOST_SUSPECTED_STALL": "The session may have made no progress for a while.",
    "item.reason.TOOL_FAILURE_LOOP": "The same tool has returned repeated failures.",
    "item.reason.NO_MEANINGFUL_PROGRESS": "The session is running without meaningful progress so far.",
    "item.reason.SUBAGENT_PRESSURE": "Active subagents have reached a pressure threshold.",
    "item.reason.CONTEXT_PRESSURE": "The session context pressure needs attention.",
    "item.reason.COMPACTION_OCCURRED": "DSH has performed a context compaction.",
    "item.reason.TASK_COMPLETED": "The session reported a normal completion.",
    "item.reason.TASK_FAILED": "The session reported a failure.",
    "item.reason.TASK_ABORTED": "The session was aborted and may need a follow-up decision.",
    "item.reason.COMPLETION_SUSPICIOUS": "The task looks complete, but its final evidence is worth checking.",
    "item.reason.HOST_STALL_RECOVERED": "The session has started producing events again.",
    "item.reason.unknown": "A runtime event needs your attention.",
    "item.suggestion.HUMAN_APPROVAL_REQUIRED": "Review the pending request in DSH and decide whether to allow it.",
    "item.suggestion.HUMAN_QUESTION_PENDING": "Answer the pending question in DSH when you are ready.",
    "item.suggestion.HOST_UNREACHABLE": "Check the DSH host and browser connection.",
    "item.suggestion.HOST_SUSPECTED_STALL": "Inspect the session before deciding whether to continue or stop.",
    "item.suggestion.TOOL_FAILURE_LOOP": "Review the repeated tool failure and the runtime environment.",
    "item.suggestion.NO_MEANINGFUL_PROGRESS": "Review the session and decide whether the task needs adjustment.",
    "item.suggestion.SUBAGENT_PRESSURE": "Review active subagents and their budgets; no automatic cancellation is performed.",
    "item.suggestion.CONTEXT_PRESSURE": "Review the context state and consider a concise continuation.",
    "item.suggestion.COMPACTION_OCCURRED": "Check whether the session context remains complete after compaction.",
    "item.suggestion.TASK_FAILED": "Inspect the failure evidence before deciding whether to retry.",
    "item.suggestion.TASK_ABORTED": "Confirm whether the aborted task should be resumed.",
    "item.suggestion.COMPLETION_SUSPICIOUS": "Check the final evidence before accepting the task as complete.",
    "item.suggestion.HOST_STALL_RECOVERED": "Review the session if the recovery was unexpected.",
    "item.suggestion.unknown": "Review the Inbox evidence before deciding what to do next.",
    "item.level": "Attention level {level}",
    "item.events": "{count} related events",
    "item.suggestion": "Suggested next step: {text}",
    "item.evidence": "View technical evidence",
    "item.evidenceLine": "{type} \xB7 {authority}",
    "item.evidence.session": "Session event",
    "item.evidence.runtime": "Runtime probe",
    "item.evidence.tool": "Tool history",
    "item.evidence.subagent": "Subagent state",
    "item.evidence.http": "HTTP probe",
    "item.authority.host": "Host",
    "item.authority.runtime": "Runtime",
    "item.authority.derived": "Derived",
    "item.authority.heuristic": "Heuristic",
    "item.technicalDetail": "Evidence basis: {text}",
    "item.policyTrace": "View decision trace",
    "item.policyVersion": "Policy version: {version}",
    "item.matchedRules": "Matched rules: {rules}",
    "item.appliedScopes": "Applied scopes: {scopes}",
    "item.suppressedBy": "Suppressed by: {values}",
    "item.authoritySummary": "Evidence authority: {text}",
    "item.finalDecision": "Final decision: {level} / {action}",
    "item.bundled": "Bundle aggregation: {count} events",
    "item.recoveryRule": "Recovery rule: {rule}",
    "item.none": "None",
    "item.acknowledge": "Acknowledge",
    "item.snooze": "Snooze",
    "item.mute": "Mute",
    "item.useful": "Useful",
    "item.irrelevant": "Not relevant",
    "item.jump": "Open in DSH",
    "item.unknownReason": "Unknown reason code: {code}",
    "state.failed": "DeepCanary status is temporarily unavailable.",
    "state.retry": "Retry",
    "common.yes": "Yes",
    "common.no": "No"
  };
  var reasonKeys = {
    HUMAN_APPROVAL_REQUIRED: "item.reason.HUMAN_APPROVAL_REQUIRED",
    HUMAN_QUESTION_PENDING: "item.reason.HUMAN_QUESTION_PENDING",
    HOST_UNREACHABLE: "item.reason.HOST_UNREACHABLE",
    HOST_SUSPECTED_STALL: "item.reason.HOST_SUSPECTED_STALL",
    TOOL_FAILURE_LOOP: "item.reason.TOOL_FAILURE_LOOP",
    NO_MEANINGFUL_PROGRESS: "item.reason.NO_MEANINGFUL_PROGRESS",
    SUBAGENT_PRESSURE: "item.reason.SUBAGENT_PRESSURE",
    CONTEXT_PRESSURE: "item.reason.CONTEXT_PRESSURE",
    COMPACTION_OCCURRED: "item.reason.COMPACTION_OCCURRED",
    TASK_COMPLETED: "item.reason.TASK_COMPLETED",
    TASK_FAILED: "item.reason.TASK_FAILED",
    TASK_ABORTED: "item.reason.TASK_ABORTED",
    COMPLETION_SUSPICIOUS: "item.reason.COMPLETION_SUSPICIOUS",
    HOST_STALL_RECOVERED: "item.reason.HOST_STALL_RECOVERED"
  };
  var suggestionKeys = {
    HUMAN_APPROVAL_REQUIRED: "item.suggestion.HUMAN_APPROVAL_REQUIRED",
    HUMAN_QUESTION_PENDING: "item.suggestion.HUMAN_QUESTION_PENDING",
    HOST_UNREACHABLE: "item.suggestion.HOST_UNREACHABLE",
    HOST_SUSPECTED_STALL: "item.suggestion.HOST_SUSPECTED_STALL",
    TOOL_FAILURE_LOOP: "item.suggestion.TOOL_FAILURE_LOOP",
    NO_MEANINGFUL_PROGRESS: "item.suggestion.NO_MEANINGFUL_PROGRESS",
    SUBAGENT_PRESSURE: "item.suggestion.SUBAGENT_PRESSURE",
    CONTEXT_PRESSURE: "item.suggestion.CONTEXT_PRESSURE",
    COMPACTION_OCCURRED: "item.suggestion.COMPACTION_OCCURRED",
    TASK_FAILED: "item.suggestion.TASK_FAILED",
    TASK_ABORTED: "item.suggestion.TASK_ABORTED",
    COMPLETION_SUSPICIOUS: "item.suggestion.COMPLETION_SUSPICIOUS",
    HOST_STALL_RECOVERED: "item.suggestion.HOST_STALL_RECOVERED"
  };
  function interpolate(text, params) {
    if (params === void 0) return text;
    return text.replace(/\{(\w+)\}/g, (_match, key) => String(params[key] ?? ""));
  }
  function fallbackTranslator(isZh) {
    const dictionary = isZh ? zh : en;
    return (key, params) => interpolate(dictionary[key] ?? key, params);
  }
  function chineseLocale() {
    const lang = document.documentElement.lang.trim().toLowerCase();
    return lang === "" || lang.startsWith("zh");
  }
  function translate(t, key, params) {
    const value = t(key, params);
    return value === key ? fallbackTranslator(chineseLocale())(key, params) : value;
  }
  function clamp(value, min, max) {
    return Math.round(Math.max(min, Math.min(max, value)));
  }
  function viewportBounds() {
    const availableWidth = Math.max(220, window.innerWidth - 16);
    const availableHeight = Math.max(220, window.innerHeight - 16);
    return {
      minWidth: Math.min(MIN_WIDTH, availableWidth),
      maxWidth: Math.max(Math.min(MAX_WIDTH, availableWidth), Math.min(MIN_WIDTH, availableWidth)),
      minHeight: Math.min(MIN_HEIGHT, availableHeight),
      maxHeight: Math.max(Math.min(MAX_HEIGHT, availableHeight), Math.min(MIN_HEIGHT, availableHeight))
    };
  }
  function safeSize() {
    let saved = {};
    try {
      const raw = window.localStorage.getItem(SIZE_KEY);
      const parsed = raw === null ? {} : JSON.parse(raw);
      if (parsed !== null && typeof parsed === "object") saved = parsed;
    } catch {
      saved = {};
    }
    const width = typeof saved.width === "number" && Number.isFinite(saved.width) ? saved.width : 420;
    const height = typeof saved.height === "number" && Number.isFinite(saved.height) ? saved.height : 560;
    return { width, height };
  }
  function clampSize(width, height) {
    const bounds = viewportBounds();
    return {
      width: clamp(width, bounds.minWidth, bounds.maxWidth),
      height: clamp(height, bounds.minHeight, bounds.maxHeight)
    };
  }
  function persistSize(width, height) {
    try {
      window.localStorage.setItem(SIZE_KEY, JSON.stringify({ width, height }));
    } catch {
    }
  }
  function makeRequestId() {
    const generated = globalThis.crypto?.randomUUID?.();
    return generated ?? `dsc-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }
  function createController() {
    const initial = safeSize();
    let state = {
      open: false,
      snapshot: void 0,
      loading: true,
      failed: false,
      ...clampSize(initial.width, initial.height),
      selectedId: void 0,
      pending: /* @__PURE__ */ new Set(),
      lastSyncedAt: void 0,
      protocolUnsupported: false
    };
    const listeners = /* @__PURE__ */ new Set();
    let disposed = false;
    let started = false;
    let inFlight = false;
    let timer;
    let abort;
    let trigger = null;
    let failureCount = 0;
    let etag;
    let visibilityHandler;
    let resizeHandler;
    const publish = (patch) => {
      state = { ...state, ...patch };
      for (const listener of [...listeners]) listener();
    };
    const request = async (path, init) => {
      try {
        return await fetch(path, { cache: "no-store", ...init });
      } catch {
        return void 0;
      }
    };
    const schedule = (delay) => {
      if (disposed) return;
      if (timer !== void 0) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        timer = void 0;
        void controller.refresh();
      }, delay);
    };
    const nextPollDelay = () => {
      if (document.visibilityState === "hidden") return 3e4;
      return Math.min(6e4, 5e3 * 2 ** Math.min(failureCount, 4));
    };
    const controller = {
      getState: () => state,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      },
      start: () => {
        if (started) return;
        started = true;
        visibilityHandler = () => {
          if (document.visibilityState === "visible") {
            failureCount = 0;
            void controller.refresh();
          } else {
            schedule(3e4);
          }
        };
        resizeHandler = () => {
          const next = clampSize(state.width, state.height);
          if (next.width !== state.width || next.height !== state.height) {
            persistSize(next.width, next.height);
            publish(next);
          }
        };
        document.addEventListener("visibilitychange", visibilityHandler);
        window.addEventListener("resize", resizeHandler);
        void controller.refresh();
      },
      dispose: () => {
        if (disposed) return;
        disposed = true;
        started = false;
        if (timer !== void 0) window.clearTimeout(timer);
        abort?.abort();
        if (visibilityHandler !== void 0) document.removeEventListener("visibilitychange", visibilityHandler);
        if (resizeHandler !== void 0) window.removeEventListener("resize", resizeHandler);
        listeners.clear();
      },
      refresh: async () => {
        if (disposed || inFlight) return;
        inFlight = true;
        abort?.abort();
        abort = new AbortController();
        try {
          const response = await fetch("/dsh-deepcanary/state", {
            cache: "no-store",
            signal: abort.signal,
            ...etag ? { headers: { "if-none-match": etag } } : {}
          });
          if (response.status === 304) {
            failureCount = 0;
            publish({ loading: false, failed: false, lastSyncedAt: (/* @__PURE__ */ new Date()).toISOString() });
            return;
          }
          if (!response.ok) throw new Error("state request failed");
          etag = response.headers.get("etag") ?? etag;
          const snapshot = await response.json();
          failureCount = 0;
          publish({
            snapshot,
            loading: false,
            failed: false,
            lastSyncedAt: snapshot.generatedAt ?? (/* @__PURE__ */ new Date()).toISOString(),
            protocolUnsupported: typeof snapshot.schemaVersion === "number" && snapshot.schemaVersion > 2
          });
        } catch {
          if (!disposed) {
            failureCount = Math.min(4, failureCount + 1);
            publish({ loading: false, failed: true });
          }
        } finally {
          inFlight = false;
          schedule(nextPollDelay());
        }
      },
      open: (id) => {
        publish({ open: true, selectedId: id });
        if (id !== void 0) void controller.action(id, { action: "seen" });
      },
      close: () => {
        publish({ open: false, selectedId: void 0 });
        window.requestAnimationFrame(() => {
          trigger?.focus();
        });
      },
      toggle: () => {
        if (state.open) controller.close();
        else controller.open();
      },
      setTrigger: (element) => {
        trigger = element;
      },
      setSize: (width, height) => {
        const next = clampSize(width, height);
        persistSize(next.width, next.height);
        publish(next);
      },
      action: async (id, payload) => {
        if (state.pending.has(id)) return;
        const nextPending = new Set(state.pending);
        nextPending.add(id);
        publish({ pending: nextPending });
        try {
          const response = await request("/dsh-deepcanary/action", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ id, requestId: makeRequestId(), ...payload })
          });
          if (!response?.ok) throw new Error("action request failed");
          await controller.refresh();
        } catch {
        } finally {
          const finished = new Set(state.pending);
          finished.delete(id);
          publish({ pending: finished });
        }
      },
      jump: async (id) => {
        const response = await request("/dsh-deepcanary/action", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, action: "jump", requestId: makeRequestId() })
        });
        if (!response?.ok) return;
        const body = await response.json();
        const result = "result" in body && body.result !== void 0 ? body.result : body;
        if (result.available && result.url) window.location.assign(result.url);
      }
    };
    return controller;
  }
  function injectStyles() {
    const existing = document.getElementById(STYLE_ID);
    if (existing) return () => {
    };
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = [
      ".dsc-trigger-layer{position:relative;display:flex;align-items:center;width:100%;height:42px;margin:8px 0 0;flex:none;font:inherit}",
      '.dsc-trigger-layer[data-rail="true"]{width:36px;height:36px;margin:0}',
      ".dsc-trigger{display:inline-flex;align-items:center;gap:8px;width:calc(100% + 4px);height:42px;margin:0 -2px;padding:0 10px 0 8px;border:0;border-radius:12px;background:transparent;color:var(--dsw-alias-label-primary,#202124);font:inherit;cursor:pointer;overflow:hidden}",
      ".dsc-trigger:hover,.dsc-trigger:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}",
      '.dsc-trigger[data-active="true"]{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12))}',
      '.dsc-trigger-layer[data-rail="true"] .dsc-trigger{justify-content:center;gap:0;width:36px;height:36px;padding:0;border-radius:50%}',
      ".dsc-trigger-label{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dsc-trigger-count{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px;font-variant-numeric:tabular-nums}",
      ".dsc-mark{display:inline-flex;align-items:center;justify-content:center;flex:none;width:20px;height:20px;color:var(--dsw-alias-state-warn-primary,#c77700)}",
      ".dsc-mark svg{width:18px;height:18px;fill:currentColor}",
      ".dsc-overlay-root{position:relative;width:100%;height:100%;pointer-events:none}",
      ".dsc-panel{position:fixed;right:16px;bottom:16px;z-index:30;display:flex;flex-direction:column;width:min(var(--dsc-width),calc(100vw - 16px));height:min(var(--dsc-height),calc(100dvh - 16px));min-width:320px;min-height:320px;max-width:calc(100vw - 16px);max-height:calc(100dvh - 16px);box-sizing:border-box;pointer-events:auto;overflow:visible;border:1px solid var(--dsw-alias-border-inverted,var(--dsw-alias-border-l2,#d9dce1));border-radius:14px;background:var(--dsw-specific-menu,var(--dsw-alias-bg-primary,#fff));box-shadow:var(--dsw-shadow-lv3,0 14px 42px rgba(0,0,0,.22));color:var(--dsw-alias-label-primary,#202124);font:13px/1.45 system-ui,sans-serif}",
      ".dsc-header{display:flex;align-items:center;gap:10px;flex:none;min-height:52px;padding:10px 12px;box-sizing:border-box;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1)}",
      ".dsc-heading{min-width:0;flex:1;display:flex;flex-direction:column;gap:1px}",
      ".dsc-title{font-size:14px;font-weight:600;line-height:20px}",
      ".dsc-subtitle{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;line-height:16px}",
      ".dsc-header-count{flex:none;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:12px;font-variant-numeric:tabular-nums}",
      ".dsc-icon-button{display:inline-flex;align-items:center;justify-content:center;flex:none;width:30px;height:30px;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;cursor:pointer}",
      ".dsc-icon-button:hover,.dsc-icon-button:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}",
      ".dsc-close{font-size:20px;line-height:1}",
      ".dsc-toolbar{display:flex;align-items:center;gap:7px;flex:none;min-height:44px;padding:7px 12px;border-bottom:1px solid var(--dsw-alias-border-l2,#eceef1)}",
      ".dsc-status{display:inline-flex;align-items:center;gap:6px;min-width:0;flex:1;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".dsc-status-dot{width:7px;height:7px;flex:none;border-radius:50%;background:var(--dsw-alias-state-success-primary,#16803c)}",
      '.dsc-status-dot[data-state="loading"]{background:var(--dsw-alias-state-warn-primary,#c77700)}',
      '.dsc-status-dot[data-state="offline"]{background:var(--dsw-alias-state-error-primary,#c5221f)}',
      ".dsc-toolbar-button,.dsc-save{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 8px;border:1px solid var(--dsw-alias-border-l2,#d9dce1);border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;font-size:11px;cursor:pointer}",
      ".dsc-toolbar-button:hover,.dsc-toolbar-button:focus-visible,.dsc-save:hover,.dsc-save:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}",
      ".dsc-body{min-height:0;flex:1;overflow:auto;padding:0 12px 14px}",
      ".dsc-note{margin:18px 4px;color:var(--dsw-alias-label-tertiary,#6b7280);text-align:center}",
      ".dsc-note strong{display:block;margin-bottom:4px;color:var(--dsw-alias-label-secondary,#4b5563);font-size:13px}",
      ".dsc-group-title{margin:11px 2px 7px;color:var(--dsw-alias-label-caption,#8a8f98);font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase}",
      ".dsc-card{display:flex;flex-direction:column;gap:7px;margin:0 0 8px;padding:11px 10px 10px;border:1px solid var(--dsw-alias-border-l2,#eceef1);border-radius:11px;background:var(--dsw-alias-bg-secondary,transparent)}",
      '.dsc-card[data-selected="true"]{border-color:var(--dsw-alias-state-warn-primary,#c77700);box-shadow:0 0 0 2px color-mix(in srgb,var(--dsw-alias-state-warn-primary,#c77700) 18%,transparent)}',
      ".dsc-card-head{display:flex;align-items:center;gap:7px;min-width:0}",
      ".dsc-level{display:inline-flex;align-items:center;justify-content:center;flex:none;min-width:27px;height:20px;padding:0 5px;border-radius:6px;background:var(--dsw-alias-state-warn-tertiary,#fff0d0);color:var(--dsw-alias-state-warn-label,#8a4b00);font-size:10px;font-weight:700}",
      '.dsc-level[data-level="C3"]{background:var(--dsw-alias-interactive-bg-hover-danger,#fce8e6);color:var(--dsw-alias-state-error-primary,#c5221f)}',
      '.dsc-level[data-level="C1"]{background:var(--dsw-alias-button-ghost-active-fill,#eef0f2);color:var(--dsw-alias-label-caption,#6b7280)}',
      ".dsc-card-reason{min-width:0;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:600}",
      ".dsc-card-time{flex:none;color:var(--dsw-alias-label-caption,#8a8f98);font-size:10px}",
      ".dsc-card-copy{margin:0;color:var(--dsw-alias-label-secondary,#4b5563);font-size:12px}",
      ".dsc-card-suggestion{margin:0;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}",
      ".dsc-card-actions{display:flex;flex-wrap:wrap;gap:5px;margin-top:1px}",
      ".dsc-card-action{padding:4px 7px;border:1px solid var(--dsw-alias-border-l2,#d9dce1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-secondary,#4b5563);font:inherit;font-size:11px;cursor:pointer}",
      '.dsc-card-action[data-primary="true"]{border-color:var(--dsw-alias-state-warn-primary,#c77700);color:var(--dsw-alias-state-warn-label,#8a4b00)}',
      ".dsc-card-action:hover:not(:disabled),.dsc-card-action:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}",
      ".dsc-card-action:disabled{cursor:default;opacity:.45}",
      ".dsc-evidence{margin-top:1px;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}",
      ".dsc-evidence summary{cursor:pointer}",
      ".dsc-evidence p{margin:5px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}",
      ".dsc-settings-card{margin:12px 0;border:1px solid var(--dsw-alias-border-l2,#eceef1);border-radius:12px;list-style:none;background:var(--dsw-alias-bg-secondary,transparent)}",
      ".dsc-settings-card-header{display:flex;align-items:center;gap:8px;width:100%;padding:12px;border:0;border-radius:12px;background:transparent;color:inherit;font:inherit;text-align:left;cursor:pointer}",
      ".dsc-settings-card-header:hover,.dsc-settings-card-header:focus-visible{background:var(--dsw-alias-interactive-bg-hover,rgba(128,128,128,.12));outline:none}",
      ".dsc-settings-card-heading{display:flex;flex:1;min-width:0;flex-direction:column;gap:2px}",
      ".dsc-settings-card-heading strong{font-size:13px;font-weight:600}",
      ".dsc-settings-card-heading span{color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px;line-height:1.4}",
      ".dsc-settings-unsaved{flex:none;color:var(--dsw-alias-state-warn-label,#8a4b00);font-size:10px}",
      ".dsc-settings-chevron{flex:none;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:14px}",
      ".dsc-settings-card-body{display:grid;gap:9px;padding:0 12px 12px;border-top:1px solid var(--dsw-alias-border-l2,#eceef1)}",
      ".dsc-settings-hint{margin:0;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}",
      ".dsc-settings-status{margin:0;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}",
      ".dsc-settings-status-error{color:var(--dsw-alias-state-error-primary,#c5221f)}",
      ".dsc-settings-fieldset{display:grid;gap:8px;margin:0;padding:8px;border:1px solid var(--dsw-alias-border-l2,#eceef1);border-radius:8px}",
      ".dsc-settings-fieldset legend{padding:0 4px;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}",
      ".dsc-settings-actions{display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap}",
      ".dsc-settings-save{display:inline-flex;align-items:center;justify-content:center;min-height:28px;padding:4px 10px;border:0;border-radius:8px;background:var(--dsw-alias-label-primary,#202124);color:var(--dsw-alias-bg-primary,#fff);font:inherit;font-size:11px;cursor:pointer}",
      ".dsc-settings-save:disabled{cursor:default;opacity:.45}",
      ".dsc-field{display:grid;gap:4px;color:var(--dsw-alias-label-tertiary,#6b7280);font-size:11px}",
      ".dsc-field-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".dsc-field input,.dsc-field select{width:100%;box-sizing:border-box;min-height:28px;padding:4px 6px;border:1px solid var(--dsw-alias-border-l2,#d9dce1);border-radius:7px;background:transparent;color:var(--dsw-alias-label-primary,#202124);font:inherit}",
      ".dsc-check{display:flex;align-items:center;gap:6px;color:var(--dsw-alias-label-secondary,#4b5563);font-size:11px}",
      ".dsc-check input{width:auto}",
      ".dsc-resize-width{position:absolute;top:58px;right:-7px;bottom:48px;width:14px;cursor:ew-resize;touch-action:none}",
      ".dsc-resize-height{position:absolute;right:48px;bottom:-7px;left:48px;height:14px;cursor:ns-resize;touch-action:none}",
      ".dsc-resize-width:focus-visible,.dsc-resize-height:focus-visible{outline:2px solid var(--dsw-alias-state-business-primary,#4b7bec);outline-offset:1px;border-radius:5px}",
      "@media (max-width:720px){.dsc-panel{right:8px;bottom:8px;width:min(var(--dsc-width),calc(100vw - 16px));height:min(var(--dsc-height),calc(100dvh - 16px))}.dsc-toolbar{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);align-items:center}.dsc-status{grid-column:1/-1;width:100%;flex:none}.dsc-toolbar-button{width:100%;min-width:0}.dsc-field-row{grid-template-columns:1fr}}",
      "@media (max-width:360px){.dsc-panel{right:4px;bottom:4px;width:calc(100vw - 8px);height:calc(100dvh - 8px);min-width:0;min-height:0;border-radius:10px}.dsc-body{padding-right:8px;padding-left:8px}.dsc-toolbar{padding-right:8px;padding-left:8px}.dsc-header{padding-right:8px;padding-left:8px}}",
      "@media (prefers-reduced-motion:reduce){.dsc-panel,.dsc-trigger{transition:none}}"
    ].join("\n");
    document.head.append(style);
    return () => {
      style.remove();
    };
  }
  function mark() {
    return (0, import_react.createElement)(
      "span",
      { className: "dsc-mark", "aria-hidden": true },
      (0, import_react.createElement)(
        "svg",
        { viewBox: "0 0 24 24", focusable: "false" },
        (0, import_react.createElement)("path", { d: "M13.2 2.2 4.5 13.3h5.9l-.7 8.5 8.8-11.2h-5.9l.6-8.4Z" })
      )
    );
  }
  function useController(controller) {
    const [state, setState] = (0, import_react.useState)(controller.getState);
    (0, import_react.useEffect)(() => controller.subscribe(() => {
      setState(controller.getState());
    }), [controller]);
    return state;
  }
  function reasonText(item, t) {
    const key = item.messageKey !== void 0 && item.messageKey in zh ? item.messageKey : reasonKeys[item.reasonCode];
    return key === void 0 ? translate(t, "item.unknownReason", { code: item.reasonCode }) : translate(t, key, item.messageParams);
  }
  function suggestionText(item, t) {
    const key = item.suggestionKey !== void 0 && item.suggestionKey in zh ? item.suggestionKey : suggestionKeys[item.reasonCode] ?? "item.suggestion.unknown";
    return translate(t, key, item.messageParams);
  }
  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(chineseLocale() ? "zh-CN" : "en-US", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }
  function notify(snapshot, t, controller) {
    if (snapshot.settings.openOnCritical && !controller.getState().open) {
      let opened = /* @__PURE__ */ new Set();
      try {
        opened = new Set(JSON.parse(window.localStorage.getItem(AUTO_OPEN_KEY) ?? "[]"));
      } catch {
        opened = /* @__PURE__ */ new Set();
      }
      const critical = snapshot.inbox.find((item) => item.level === "C3" && AUTO_OPEN_REASONS.has(item.reasonCode) && !opened.has(item.id));
      if (critical !== void 0) {
        opened.add(critical.id);
        try {
          window.localStorage.setItem(AUTO_OPEN_KEY, JSON.stringify([...opened].slice(-100)));
        } catch {
        }
        controller.open(critical.id);
      }
    }
    if (!("Notification" in globalThis) || Notification.permission !== "granted") return;
    let seen = /* @__PURE__ */ new Set();
    try {
      seen = new Set(JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "[]"));
    } catch {
      seen = /* @__PURE__ */ new Set();
    }
    for (const item of snapshot.inbox.filter((value) => (value.level === "C2" || value.level === "C3") && !seen.has(value.id)).slice(0, 3)) {
      const notification = new Notification("DeepCanary \xB7 " + item.level, {
        body: reasonText(item, t),
        tag: item.id
      });
      notification.onclick = () => {
        handleNotificationClick(notification, item.id, controller.open, () => {
          window.focus();
        });
      };
      seen.add(item.id);
    }
    try {
      window.localStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-100)));
    } catch {
    }
  }
  function ResizeHandle(props) {
    const origin = (0, import_react.useRef)(void 0);
    const onPointerDown = (event) => {
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      origin.current = { x: event.clientX, y: event.clientY, value: props.value };
    };
    const onPointerMove = (event) => {
      if (origin.current === void 0 || !event.currentTarget.hasPointerCapture(event.pointerId)) return;
      const delta = props.axis === "width" ? event.clientX - origin.current.x : event.clientY - origin.current.y;
      props.onResize(clamp(origin.current.value - delta, props.min, props.max));
    };
    const onPointerUp = (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      origin.current = void 0;
    };
    const onPointerCancel = (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      origin.current = void 0;
    };
    const onKeyDown = (event) => {
      const positive = props.axis === "width" ? event.key === "ArrowLeft" : event.key === "ArrowUp";
      const negative = props.axis === "width" ? event.key === "ArrowRight" : event.key === "ArrowDown";
      const step = event.shiftKey ? 48 : 12;
      if (event.key === "Home") props.onResize(props.min);
      else if (event.key === "End") props.onResize(props.max);
      else if (positive) props.onResize(clamp(props.value + step, props.min, props.max));
      else if (negative) props.onResize(clamp(props.value - step, props.min, props.max));
      else return;
      event.preventDefault();
    };
    return (0, import_react.createElement)("div", {
      className: props.axis === "width" ? "dsc-resize-width" : "dsc-resize-height",
      role: "separator",
      "aria-orientation": props.axis === "width" ? "vertical" : "horizontal",
      "aria-label": props.label,
      "aria-valuemin": props.min,
      "aria-valuemax": props.max,
      "aria-valuenow": props.value,
      tabIndex: 0,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onKeyDown
    });
  }
  function field(label, control) {
    return (0, import_react.createElement)("label", { className: "dsc-field" }, (0, import_react.createElement)("span", null, label), control);
  }
  var SETTINGS_KEYS = [
    "notificationLevel",
    "openOnCritical",
    "maxInterruptsPerHour",
    "dedupeWindowMinutes",
    "bundleWindowSeconds",
    "longRunThresholdMinutes",
    "subagentPressure",
    "quietHours",
    "privacySafeSummary",
    "healthPollSeconds",
    "maxInboxItems"
  ];
  var DEFAULT_SETTINGS = {
    notificationLevel: "C2",
    openOnCritical: false,
    maxInterruptsPerHour: 3,
    dedupeWindowMinutes: 10,
    bundleWindowSeconds: 60,
    longRunThresholdMinutes: 5,
    subagentPressure: "standard",
    quietHours: { enabled: false, start: "22:00", end: "08:00" },
    privacySafeSummary: true,
    healthPollSeconds: 15,
    maxInboxItems: 500
  };
  function settingsValue(value) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) return void 0;
    const input = value;
    return {
      ...DEFAULT_SETTINGS,
      ...input,
      quietHours: { ...DEFAULT_SETTINGS.quietHours, ...input.quietHours }
    };
  }
  function DeepCanarySettingsCard(props) {
    const scope = props.settingsScope;
    if (scope === void 0) return null;
    const [remote, setRemote] = (0, import_react.useState)(() => scope.getSnapshot());
    const [draft, setDraft] = (0, import_react.useState)(() => settingsValue(scope.getSnapshot().value));
    const [dirty, setDirty] = (0, import_react.useState)(false);
    const [saving, setSaving] = (0, import_react.useState)(false);
    const [failed, setFailed] = (0, import_react.useState)(false);
    const [open, setOpen] = (0, import_react.useState)(false);
    const [resetFields, setResetFields] = (0, import_react.useState)(/* @__PURE__ */ new Set());
    (0, import_react.useEffect)(() => {
      const update = () => {
        setRemote(scope.getSnapshot());
      };
      update();
      return scope.subscribe(update);
    }, [scope]);
    (0, import_react.useEffect)(() => {
      if (!dirty && remote.value !== void 0) {
        setDraft(settingsValue(remote.value));
        setResetFields(/* @__PURE__ */ new Set());
      }
    }, [dirty, remote.value]);
    if (remote.value === void 0 || remote.status === "loading" || remote.status === "unavailable") return null;
    const current = draft ?? settingsValue(remote.value) ?? DEFAULT_SETTINGS;
    const base = settingsValue(remote.base) ?? DEFAULT_SETTINGS;
    const disabled = !remote.writable || saving;
    const edit = (key, value) => {
      setDraft((previous) => ({ ...previous ?? current, [key]: value }));
      setDirty(true);
      setFailed(false);
      setResetFields((previous) => {
        const next = new Set(previous);
        next.delete(key);
        return next;
      });
    };
    const discard = () => {
      setDraft(settingsValue(remote.value));
      setDirty(false);
      setFailed(false);
      setResetFields(/* @__PURE__ */ new Set());
    };
    const reset = () => {
      setDraft(base);
      setDirty(true);
      setFailed(false);
      setResetFields(new Set(SETTINGS_KEYS));
    };
    const save = () => {
      if (!dirty || disabled || remote.revision === void 0) return;
      const operations = SETTINGS_KEYS.map((key) => resetFields.has(key) ? { op: "unset", path: [key] } : { op: "set", path: [key], value: current[key] });
      setSaving(true);
      setFailed(false);
      void scope.mutate(operations, remote.revision).then(() => {
        setDirty(false);
        setResetFields(/* @__PURE__ */ new Set());
      }).catch(() => {
        setFailed(true);
      }).finally(() => {
        setSaving(false);
      });
    };
    const t = props.t;
    return (0, import_react.createElement)(
      "li",
      { className: "dsc-settings-card", "data-deepcanary-settings-card": true },
      (0, import_react.createElement)(
        "button",
        {
          type: "button",
          className: "dsc-settings-card-header",
          "aria-expanded": open,
          onClick: () => {
            setOpen((value) => !value);
          }
        },
        (0, import_react.createElement)(
          "span",
          { className: "dsc-settings-card-heading" },
          (0, import_react.createElement)("strong", null, translate(t, "settings.title")),
          (0, import_react.createElement)("span", null, translate(t, "settings.description"))
        ),
        dirty && (0, import_react.createElement)("span", { className: "dsc-settings-unsaved" }, translate(t, "settings.unsaved")),
        (0, import_react.createElement)("span", { className: "dsc-settings-chevron", "aria-hidden": true }, open ? "\u25B4" : "\u25BE")
      ),
      open && (0, import_react.createElement)(
        "div",
        { className: "dsc-settings-card-body" },
        (0, import_react.createElement)("p", { className: "dsc-settings-hint" }, translate(t, "settings.hint")),
        !remote.writable && (0, import_react.createElement)("p", { className: "dsc-settings-status", role: "status" }, translate(t, "settings.readOnly")),
        field(
          translate(t, "settings.level"),
          (0, import_react.createElement)("select", {
            value: current.notificationLevel,
            disabled,
            onChange: (event) => {
              edit("notificationLevel", event.target.value);
            }
          }, ...["C1", "C2", "C3"].map((value) => (0, import_react.createElement)("option", { key: value, value }, value)))
        ),
        (0, import_react.createElement)(
          "label",
          { className: "dsc-check" },
          (0, import_react.createElement)("input", {
            type: "checkbox",
            checked: current.openOnCritical,
            disabled,
            onChange: (event) => {
              edit("openOnCritical", event.target.checked);
            }
          }),
          translate(t, "settings.openOnCritical")
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsc-field-row" },
          field(translate(t, "settings.maxInterrupts"), (0, import_react.createElement)("input", { type: "number", min: 0, max: 10, step: 1, value: current.maxInterruptsPerHour, disabled, onChange: (event) => {
            edit("maxInterruptsPerHour", Number(event.target.value));
          } })),
          field(translate(t, "settings.dedupe"), (0, import_react.createElement)("input", { type: "number", min: 0, max: 120, step: 1, value: current.dedupeWindowMinutes, disabled, onChange: (event) => {
            edit("dedupeWindowMinutes", Number(event.target.value));
          } }))
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsc-field-row" },
          field(translate(t, "settings.bundle"), (0, import_react.createElement)("input", { type: "number", min: 0, max: 900, step: 1, value: current.bundleWindowSeconds, disabled, onChange: (event) => {
            edit("bundleWindowSeconds", Number(event.target.value));
          } })),
          field(translate(t, "settings.longRun"), (0, import_react.createElement)("input", { type: "number", min: 1, max: 120, step: 1, value: current.longRunThresholdMinutes, disabled, onChange: (event) => {
            edit("longRunThresholdMinutes", Number(event.target.value));
          } }))
        ),
        field(
          translate(t, "settings.subagent"),
          (0, import_react.createElement)(
            "select",
            { value: current.subagentPressure, disabled, onChange: (event) => {
              edit("subagentPressure", event.target.value);
            } },
            ...["relaxed", "standard", "strict"].map((value) => (0, import_react.createElement)("option", { key: value, value }, translate(t, "settings.subagent." + value)))
          )
        ),
        (0, import_react.createElement)(
          "fieldset",
          { className: "dsc-settings-fieldset" },
          (0, import_react.createElement)("legend", null, translate(t, "settings.quiet")),
          (0, import_react.createElement)(
            "label",
            { className: "dsc-check" },
            (0, import_react.createElement)("input", { type: "checkbox", checked: current.quietHours.enabled, disabled, onChange: (event) => {
              edit("quietHours", { ...current.quietHours, enabled: event.target.checked });
            } }),
            translate(t, "settings.quietEnable")
          ),
          (0, import_react.createElement)(
            "div",
            { className: "dsc-field-row" },
            field(translate(t, "settings.quietStart"), (0, import_react.createElement)("input", { type: "time", value: current.quietHours.start, disabled, onChange: (event) => {
              edit("quietHours", { ...current.quietHours, start: event.target.value });
            } })),
            field(translate(t, "settings.quietEnd"), (0, import_react.createElement)("input", { type: "time", value: current.quietHours.end, disabled, onChange: (event) => {
              edit("quietHours", { ...current.quietHours, end: event.target.value });
            } }))
          )
        ),
        (0, import_react.createElement)(
          "label",
          { className: "dsc-check" },
          (0, import_react.createElement)("input", { type: "checkbox", checked: current.privacySafeSummary, disabled, onChange: (event) => {
            edit("privacySafeSummary", event.target.checked);
          } }),
          translate(t, "settings.privacy")
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsc-field-row" },
          field(translate(t, "settings.healthPoll"), (0, import_react.createElement)("input", { type: "number", min: 5, max: 300, step: 1, value: current.healthPollSeconds, disabled, onChange: (event) => {
            edit("healthPollSeconds", Number(event.target.value));
          } })),
          field(translate(t, "settings.maxInbox"), (0, import_react.createElement)("input", { type: "number", min: 50, max: 5e3, step: 50, value: current.maxInboxItems, disabled, onChange: (event) => {
            edit("maxInboxItems", Number(event.target.value));
          } }))
        ),
        failed && (0, import_react.createElement)("p", { className: "dsc-settings-status dsc-settings-status-error", role: "status" }, translate(t, remote.revision === void 0 ? "settings.saveFailed" : "settings.conflict")),
        (0, import_react.createElement)(
          "div",
          { className: "dsc-settings-actions" },
          (0, import_react.createElement)("button", { type: "button", className: "dsc-toolbar-button", disabled: !dirty || saving, onClick: discard }, translate(t, "settings.discard")),
          (0, import_react.createElement)("button", { type: "button", className: "dsc-toolbar-button", disabled, onClick: reset }, translate(t, "settings.reset")),
          (0, import_react.createElement)("button", { type: "button", className: "dsc-settings-save", disabled: !dirty || disabled || remote.revision === void 0, onClick: save }, translate(t, saving ? "settings.saving" : "settings.save"))
        )
      )
    );
  }
  function DeepCanaryTrigger(props) {
    const state = useController(props.controller);
    const ref = (0, import_react.useRef)(null);
    (0, import_react.useEffect)(() => {
      props.controller.setTrigger(ref.current);
      return () => {
        props.controller.setTrigger(null);
      };
    }, [props.controller]);
    const count = state.snapshot?.status.openInbox ?? 0;
    const label = translate(props.t, state.open ? "trigger.close" : "trigger.open");
    return (0, import_react.createElement)(
      "div",
      {
        className: "dsc-trigger-layer",
        "data-rail": !props.wide,
        "data-deepcanary-trigger-layer": true
      },
      (0, import_react.createElement)(
        "button",
        {
          ref,
          type: "button",
          className: "dsc-trigger",
          "data-deepcanary-trigger": true,
          "data-active": state.open || count > 0,
          "aria-expanded": state.open,
          "aria-label": count > 0 ? translate(props.t, "trigger.count", { count }) : label,
          title: label,
          onClick: () => {
            props.controller.toggle();
          }
        },
        mark(),
        props.wide && (0, import_react.createElement)("span", { className: "dsc-trigger-label" }, translate(props.t, "panel.title")),
        props.wide && (0, import_react.createElement)("span", { className: "dsc-trigger-count" }, String(count))
      )
    );
  }
  function evidenceType(value, t) {
    const key = value === "session-event" ? "item.evidence.session" : value === "runtime-probe" ? "item.evidence.runtime" : value === "tool-history" ? "item.evidence.tool" : value === "subagent-state" ? "item.evidence.subagent" : value === "http-probe" ? "item.evidence.http" : void 0;
    return key === void 0 ? value : translate(t, key);
  }
  function authorityText(value, t) {
    const key = value === "host" ? "item.authority.host" : value === "runtime" ? "item.authority.runtime" : value === "derived" ? "item.authority.derived" : value === "heuristic" ? "item.authority.heuristic" : void 0;
    return key === void 0 ? value : translate(t, key);
  }
  function actionButton(label, onClick, disabled, primary = false) {
    return (0, import_react.createElement)("button", {
      type: "button",
      className: "dsc-card-action",
      "data-primary": primary,
      disabled,
      onClick
    }, label);
  }
  function decisionTraceDetails(item, t) {
    const trace = item.decisionTrace;
    if (trace === void 0) return void 0;
    const authority = Object.entries(trace.authoritySummary.counts).filter(([, count]) => count > 0).map(([name, count]) => `${authorityText(name, t)} ${count}`).join(" \xB7 ");
    const traceRows = [
      (0, import_react.createElement)("p", { key: "version" }, translate(t, "item.policyVersion", { version: trace.policyVersion })),
      (0, import_react.createElement)("p", { key: "rules" }, translate(t, "item.matchedRules", { rules: trace.matchedRules.join(", ") || translate(t, "item.none") })),
      (0, import_react.createElement)("p", { key: "scopes" }, translate(t, "item.appliedScopes", { scopes: trace.appliedScopes.join(", ") || translate(t, "item.none") })),
      (0, import_react.createElement)("p", { key: "suppressed" }, translate(t, "item.suppressedBy", { values: trace.suppressedBy.join(", ") || translate(t, "item.none") })),
      (0, import_react.createElement)("p", { key: "authority" }, translate(t, "item.authoritySummary", { text: authority || translate(t, "item.none") })),
      (0, import_react.createElement)("p", { key: "final" }, translate(t, "item.finalDecision", { level: trace.finalLevel, action: trace.finalAction }))
    ];
    if (trace.bundledWith !== void 0) traceRows.push((0, import_react.createElement)("p", { key: "bundle" }, translate(t, "item.bundled", { count: trace.bundledWith.eventCount })));
    if (trace.recoveryRule !== void 0) traceRows.push((0, import_react.createElement)("p", { key: "recovery" }, translate(t, "item.recoveryRule", { rule: trace.recoveryRule })));
    return (0, import_react.createElement)(
      "details",
      { className: "dsc-evidence", key: "decision-trace" },
      (0, import_react.createElement)("summary", null, translate(t, "item.policyTrace")),
      ...traceRows
    );
  }
  function itemCard(item, state, t, controller, selected) {
    const busy = state.pending.has(item.id);
    const reason = reasonText(item, t);
    const evidence = item.evidence.map((value) => translate(t, "item.evidenceLine", {
      type: evidenceType(value.type, t),
      authority: authorityText(value.authority, t)
    })).join(" \xB7 ");
    const children = [
      (0, import_react.createElement)(
        "div",
        { className: "dsc-card-head", key: "head" },
        (0, import_react.createElement)("span", {
          className: "dsc-level",
          "data-level": item.level,
          title: translate(t, "item.level", { level: item.level })
        }, item.level),
        (0, import_react.createElement)("span", { className: "dsc-card-reason" }, reason),
        (0, import_react.createElement)("time", { className: "dsc-card-time", dateTime: item.occurredAt }, formatTime(item.occurredAt))
      ),
      (0, import_react.createElement)("p", { className: "dsc-card-copy", key: "copy" }, reason),
      (0, import_react.createElement)(
        "p",
        { className: "dsc-card-suggestion", key: "suggestion" },
        translate(t, "item.suggestion", { text: suggestionText(item, t) })
      )
    ];
    if (item.bundleCount > 1) {
      children.push((0, import_react.createElement)(
        "small",
        { className: "dsc-card-suggestion", key: "events" },
        translate(t, "item.events", { count: item.bundleCount })
      ));
    }
    children.push((0, import_react.createElement)(
      "details",
      { className: "dsc-evidence", key: "evidence" },
      (0, import_react.createElement)("summary", null, translate(t, "item.evidence") + (evidence ? " \xB7 " + evidence : "")),
      (0, import_react.createElement)("p", null, translate(t, "item.technicalDetail", { text: reason }))
    ));
    const traceDetails = decisionTraceDetails(item, t);
    if (traceDetails !== void 0) children.push(traceDetails);
    const actions = [
      actionButton(translate(t, "item.acknowledge"), () => {
        void controller.action(item.id, { action: "acknowledge" });
      }, busy, true),
      actionButton(translate(t, "item.snooze"), () => {
        void controller.action(item.id, { action: "snooze", minutes: 30 });
      }, busy),
      actionButton(translate(t, "item.mute"), () => {
        void controller.action(item.id, { action: "mute" });
      }, busy),
      actionButton(translate(t, "item.useful"), () => {
        void controller.action(item.id, { action: "feedback", useful: true });
      }, busy),
      actionButton(translate(t, "item.irrelevant"), () => {
        void controller.action(item.id, { action: "feedback", useful: false });
      }, busy)
    ];
    if (item.sessionId) {
      actions.push(actionButton(translate(t, "item.jump"), () => {
        void controller.jump(item.id);
      }, busy));
    }
    children.push((0, import_react.createElement)("div", { className: "dsc-card-actions", key: "actions" }, ...actions));
    return (0, import_react.createElement)("article", {
      className: "dsc-card",
      key: item.id,
      "data-deepcanary-item": item.id,
      "data-selected": selected
    }, ...children);
  }
  function DeepCanaryOverlay(props) {
    const state = useController(props.controller);
    const panelRef = (0, import_react.useRef)(null);
    const closeRef = (0, import_react.useRef)(null);
    const positionedId = (0, import_react.useRef)(void 0);
    (0, import_react.useLayoutEffect)(() => {
      if (state.open) closeRef.current?.focus();
    }, [state.open]);
    (0, import_react.useEffect)(() => {
      if (!state.open || state.selectedId === void 0) {
        positionedId.current = void 0;
        return;
      }
      if (positionedId.current === state.selectedId) return;
      const elements = panelRef.current?.querySelectorAll("[data-deepcanary-item]") ?? [];
      if (positionSelectedAttention(elements, state.selectedId)) positionedId.current = state.selectedId;
    }, [state.open, state.selectedId, state.snapshot]);
    (0, import_react.useEffect)(() => {
      if (!state.open) return;
      const onKeyDown = (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          props.controller.close();
        }
      };
      const onPointerDown = (event) => {
        const target = event.target;
        if (!(target instanceof Node)) return;
        if (panelRef.current?.contains(target)) return;
        if (target instanceof Element && target.closest("[data-deepcanary-trigger]") !== null) return;
        props.controller.close();
      };
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("pointerdown", onPointerDown);
      return () => {
        document.removeEventListener("keydown", onKeyDown);
        document.removeEventListener("pointerdown", onPointerDown);
      };
    }, [props.controller, state.open]);
    (0, import_react.useEffect)(() => {
      if (state.snapshot !== void 0) notify(state.snapshot, props.t, props.controller);
    }, [props.controller, props.t, state.snapshot]);
    if (!state.open) return null;
    const snapshot = state.snapshot;
    const statusState = state.failed || state.protocolUnsupported ? "offline" : state.loading ? "loading" : "ready";
    const statusText = state.failed ? translate(props.t, "panel.status.offline") : state.protocolUnsupported ? translate(props.t, "panel.updateRequired") : state.loading ? translate(props.t, "panel.status.loading") : translate(props.t, "panel.status.ready");
    const items = snapshot?.inbox ?? [];
    const panelStyle = {
      "--dsc-width": state.width + "px",
      "--dsc-height": state.height + "px"
    };
    const body = [];
    if (snapshot !== void 0) {
      body.push((0, import_react.createElement)("p", { className: "dsc-settings-hint", key: "settings-location" }, translate(props.t, "panel.settingsLocation")));
      if (state.protocolUnsupported) body.push((0, import_react.createElement)("p", { className: "dsc-note", key: "protocol" }, translate(props.t, "panel.updateRequired")));
    }
    if (state.failed && snapshot === void 0) {
      body.push((0, import_react.createElement)(
        "div",
        { className: "dsc-note", key: "failed" },
        (0, import_react.createElement)("strong", null, translate(props.t, "state.failed")),
        (0, import_react.createElement)("button", {
          className: "dsc-toolbar-button",
          type: "button",
          onClick: () => {
            void props.controller.refresh();
          }
        }, translate(props.t, "state.retry"))
      ));
    } else if (state.loading && snapshot === void 0) {
      body.push((0, import_react.createElement)(
        "p",
        { className: "dsc-note", key: "loading" },
        translate(props.t, "panel.status.loading")
      ));
    } else if (items.length === 0) {
      body.push((0, import_react.createElement)(
        "div",
        { className: "dsc-note", key: "empty" },
        (0, import_react.createElement)("strong", null, translate(props.t, "panel.empty")),
        (0, import_react.createElement)("span", null, translate(props.t, "panel.emptyHint"))
      ));
    } else {
      body.push((0, import_react.createElement)(
        "h3",
        { className: "dsc-group-title", key: "group" },
        translate(props.t, "panel.title")
      ));
      for (const item of items.slice(0, 50)) {
        body.push(itemCard(item, state, props.t, props.controller, state.selectedId === item.id));
      }
    }
    const notificationSupported = "Notification" in globalThis;
    return (0, import_react.createElement)(
      "div",
      { className: "dsc-overlay-root", "data-deepcanary-overlay": true },
      (0, import_react.createElement)(
        "section",
        {
          ref: panelRef,
          className: "dsc-panel",
          style: panelStyle,
          role: "dialog",
          "aria-modal": false,
          "aria-labelledby": "dsc-panel-title",
          "data-deepcanary-panel": true,
          "data-open": true
        },
        (0, import_react.createElement)(
          "header",
          { className: "dsc-header" },
          (0, import_react.createElement)(
            "span",
            { className: "dsc-heading" },
            (0, import_react.createElement)(
              "span",
              { className: "dsc-title", id: "dsc-panel-title" },
              translate(props.t, "panel.title")
            ),
            (0, import_react.createElement)(
              "span",
              { className: "dsc-subtitle" },
              translate(props.t, "panel.subtitle")
            )
          ),
          (0, import_react.createElement)("span", { className: "dsc-header-count" }, String(snapshot?.status.openInbox ?? 0)),
          (0, import_react.createElement)("button", {
            ref: closeRef,
            className: "dsc-icon-button dsc-close",
            type: "button",
            "data-deepcanary-close": true,
            "aria-label": translate(props.t, "panel.close"),
            title: translate(props.t, "panel.close"),
            onClick: () => {
              props.controller.close();
            }
          }, "\xD7")
        ),
        (0, import_react.createElement)(
          "div",
          { className: "dsc-toolbar" },
          (0, import_react.createElement)(
            "span",
            { className: "dsc-status", role: "status", "aria-live": "polite", "aria-atomic": true },
            (0, import_react.createElement)("span", { className: "dsc-status-dot", "data-state": statusState, "aria-hidden": true }),
            statusText,
            snapshot !== void 0 && " \xB7 " + translate(props.t, "panel.sessions", { count: snapshot.status.sessions }),
            state.lastSyncedAt !== void 0 && " \xB7 " + translate(props.t, "panel.lastSynced", { time: formatTime(state.lastSyncedAt) })
          ),
          (0, import_react.createElement)("button", {
            className: "dsc-toolbar-button",
            type: "button",
            disabled: state.loading,
            "aria-label": translate(props.t, "panel.refresh"),
            onClick: () => {
              void props.controller.refresh();
            }
          }, state.loading ? translate(props.t, "panel.refreshing") : translate(props.t, "panel.refresh")),
          (0, import_react.createElement)("button", {
            className: "dsc-toolbar-button",
            type: "button",
            disabled: !notificationSupported,
            onClick: () => {
              if (notificationSupported) {
                void Notification.requestPermission().then(() => {
                  void props.controller.refresh();
                });
              }
            }
          }, !notificationSupported ? translate(props.t, "panel.notification.unavailable") : Notification.permission === "granted" ? translate(props.t, "panel.notification.enabled") : translate(props.t, "panel.notification.enable"))
        ),
        (0, import_react.createElement)("div", {
          className: "dsc-body",
          role: "region",
          "aria-label": translate(props.t, "panel.bodyLabel")
        }, ...body),
        (() => {
          const bounds = viewportBounds();
          return (0, import_react.createElement)(ResizeHandle, {
            axis: "width",
            value: state.width,
            min: bounds.minWidth,
            max: bounds.maxWidth,
            label: translate(props.t, "panel.resize.width"),
            onResize: (width) => {
              props.controller.setSize(width, state.height);
            }
          });
        })(),
        (0, import_react.createElement)(ResizeHandle, {
          axis: "height",
          value: state.height,
          min: viewportBounds().minHeight,
          max: viewportBounds().maxHeight,
          label: translate(props.t, "panel.resize.height"),
          onResize: (height) => {
            props.controller.setSize(state.width, height);
          }
        })
      )
    );
  }
  var inject = ["slots", "locale", "settingsScope"];
  function apply(ctx) {
    const controller = createController();
    ctx.effect(() => injectStyles(), "deepcanary: client styles");
    ctx.effect(() => {
      controller.start();
      return () => {
        controller.dispose();
      };
    }, "deepcanary: client controller");
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), "deepcanary: dictionaries");
    ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
      name: "sidebar.footer.action",
      id: "deepcanary-trigger",
      locale: NS,
      inject: () => ({ controller })
    }, DeepCanaryTrigger));
    ctx.slots.inject("shell.overlay", () => ctx.slots.register({
      name: "shell.overlay",
      id: "deepcanary-overlay",
      locale: NS,
      inject: () => ({ controller })
    }, DeepCanaryOverlay));
    const settingsScope = ctx.settingsScope?.bind({
      namespace: SETTINGS_NS,
      decode: (value) => settingsValue(value)
    });
    if (settingsScope !== void 0) {
      ctx.slots.inject("settings.plugin.item", () => ctx.slots.register({
        name: "settings.plugin.item",
        key: SETTINGS_NS,
        locale: NS,
        inject: () => ({ settingsScope })
      }, DeepCanarySettingsCard));
    }
  }

    return module.exports;
  }
});
