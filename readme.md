# Xupopter Runner
Executes crawling recipes coming from Xupopter Chrome Extension.


## Usage

You can either use the docker container (recommended as contains both the backend and a runner) or manually run it.

### Docker
```
version: "3.3"
services:
  xupopter-runner:
    image: ghcr.io/tetreum/xupopter_runner:latest
    container_name: xupopter-runner
    ports:
      - 8089:8089
    environment:
      - JWT_ACCESS_SECRET=SAME_SECRET_AS_XUPOPTER_CLIENT # Write the same secret that xupopter client .env has
    volumes:
      - /path/to/config:/app/config # Make sure your local config directory exists
      - /where/i/want/to/store/scrapped_data:/app/public # Make sure your local config directory exists
```