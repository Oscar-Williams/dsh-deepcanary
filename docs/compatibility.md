# Compatibility

[简体中文](compatibility.zh-CN.md) · [Installation](../README.md#install)

DeepCanary 0.1.8 uses one package and interface across the following hosts.

| DSH version | WebUI | Windows Desktop | Node.js for WebUI |
| --- | --- | --- | --- |
| 0.2.1-rc.5 | Tested | Official application tested | ^22.19.0 or >=24.0.0 |
| 0.2.2-alpha.3 | Tested | Fixed source build tested | >=24.9.0 |

The package declares `engines.dsh = "0.2.1-rc.5 || >=0.2.2-alpha.3"`. Later releases can install without a whitelist change. They enter the tested range after checks in the actual host. Earlier DSH versions are outside the supported range.

The alpha.3 Desktop test uses an unsigned build from source commit `05b1cae8db6e674c5685101494d4eec24652424a`. The tested official RC5 Desktop reports commit `d4db512a969fccf0c5cc7ec8fe38e9c1d27af916`; the RC5 source tag points to `b830ec950faba0a46dda564be3e2d854afed94f1`.

## Interface

Both versions provide Pending, Snoozed, Activity, reminder settings, session navigation, and panel controls. alpha.3 uses its unified context menu and settings icon API. RC5 provides equivalent actions through public session slots and the inbox menu.

Layout checks include light and dark themes, narrow windows, keyboard controls, emulated touch, and actual Edge browser zoom at 200%. Physical touchscreen hardware and other operating systems have not been tested.

## Notifications

Web notifications need permission for the DSH origin and a running page. Desktop notifications need a running application. Windows tests covered minimized and hidden Desktop windows, system banners, and return to the corresponding reminder.

Fully quitting Desktop stops the host and renderer. Browser permissions, Windows Do Not Disturb, quiet hours, and reminder budgets affect visible delivery.

## Host updates

Optional services are resolved by capability. The plugin uses public DSH services and disposes its registrations when disabled or removed. See [Public DSH interfaces](dsh-surface-audit.md) for integration details.

When a DSH update changes an interface used by DeepCanary, run the affected contracts and test that behavior in the application before extending the tested range.
