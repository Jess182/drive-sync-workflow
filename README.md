## Drive sync workflow

### Description

Github workflow that allows sync changes from google drive folder inside repository

### Inputs

Variables from Github repository

#### Secrets

- CLIENT_ID # google client ID
- CLIENT_SECRET # google client secret
- REFRESH_TOKEN # google client refresh token

#### Variables

- FOLDER_ID # drive folder to sync
- OUTPUT_DIR # repo folder where files will download
