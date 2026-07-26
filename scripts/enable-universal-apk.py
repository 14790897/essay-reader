#!/usr/bin/env python3
"""Insert splits block for universal APK into android/app/build.gradle."""
import sys

path = 'android/app/build.gradle'
with open(path, 'r') as f:
    content = f.read()

old_block = "    androidResources {\n        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'\n    }\n}"
new_block = "    androidResources {\n        ignoreAssetsPattern '!.svn:!.git:!.ds_store:!*.scc:!CVS:!thumbs.db:!picasa.ini:!*~'\n    }\n    splits {\n        abi {\n            enable false\n            universalApk true\n        }\n    }\n}"

if old_block in content:
    content = content.replace(old_block, new_block)
    with open(path, 'w') as f:
        f.write(content)
    print('Universal APK config added.')
else:
    print('Warning: Could not find target block in build.gradle', file=sys.stderr)
    sys.exit(1)
