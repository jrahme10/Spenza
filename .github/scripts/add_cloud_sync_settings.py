from pathlib import Path

p=Path('src/App.tsx')
s=p.read_text()

import_anchor="import SecuritySettings from './components/SecuritySettings'"
if "import CloudSyncSettings from './components/CloudSyncSettings'" not in s:
    assert import_anchor in s, 'SecuritySettings import anchor missing'
    s=s.replace(import_anchor,import_anchor+"\nimport CloudSyncSettings from './components/CloudSyncSettings'",1)

settings_anchor='<h3 className="settingsGroupTitle">Security</h3><section className="settingsList"><SecuritySettings data={data} setData={setData}/></section>'
cloud_section='<h3 className="settingsGroupTitle">Cloud Sync</h3><CloudSyncSettings data={data} setData={setData}/>'
if cloud_section not in s:
    assert settings_anchor in s, 'Settings section anchor missing'
    s=s.replace(settings_anchor,cloud_section+settings_anchor,1)

p.write_text(s)
