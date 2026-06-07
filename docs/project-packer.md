
# Project Packer

Files:

- src/lib/packer/ — types, format, filter, presets, pack, unpack

- src/components/packer/ — PackPanel, UnpackPanel, Dropzone, PartOutput, PackerOptions, TerminalLog

- src/routes/ProjectPacker.tsx

## Use Case

Pack project React thành text để copy-paste qua chat (công ty block file transfer). Bên nhận paste → unpack → download ZIP.

## Format

Markers giữ tương thích v1:

```


===FILE_START===

PATH: src/App.tsx

CONTENT_START:

import React from 'react';

...
