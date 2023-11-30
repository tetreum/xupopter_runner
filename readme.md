# Xupopter Runner
Executes crawling recipes coming from [Xupopter Chrome Extension](https://github.com/tetreum/xupopter_chrome_extension).


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

The runner will be available at `http://localhost:8089`

### Non-docker

`JWT_ACCESS_SECRET=test npm start`

The runner will be available at `http://localhost:8089`

Request sample:
```curl
curl --request POST \
  --url http://localhost:8089/ \
  --header 'Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJPbmxpbmUgSldUIEJ1aWxkZXIiLCJpYXQiOjE3MDEzNDk3NzUsImV4cCI6MTczMjg4NTc3NSwiYXVkIjoid3d3LmV4YW1wbGUuY29tIiwic3ViIjoianJvY2tldEBleGFtcGxlLmNvbSIsIkdpdmVuTmFtZSI6IkpvaG5ueSIsIlN1cm5hbWUiOiJSb2NrZXQiLCJFbWFpbCI6Impyb2NrZXRAZXhhbXBsZS5jb20iLCJSb2xlIjpbIk1hbmFnZXIiLCJQcm9qZWN0IEFkbWluaXN0cmF0b3IiXX0.Ah4sSyoF1QUD65RyMCRjYKta9dOWdEEyCNvd00CqBzM' \
  --header 'Content-Type: application/json'
  --data '{
	    "id": "home-crawler",
		"recipe": {
			"id": "a57ddd92-f32f-4bab-98d5-747a7193d924",
			"name": "Local test",
			"expected_output": "item",
			"schema": 1,
			"blocks": [
				{
					"id": "f3b85729-b967-4a3a-8cb4-f5c8d465be34",
					"type": "start",
					"details": {
						"type": "url",
						"source": "https://localhost:8080/"
					}
				},
				{
					"id": "40a9215d-7888-4ae1-b192-a2ae9ce21097",
					"type": "extract",
					"details": {
						"name": "title",
						"selector": "#results-container [class=\"item row border-bottom p-2\"] h3",
						"property": "text"
					}
				}
			]
		}
}'
```

Runner results can be downloaded by visiting the following url: `http://localhost:8089/public/SENT_ID/result.json`
Ex: `http://localhost:8089/public/home-crawler/result.json`
A debugging log will also be available for each run: `http://localhost:8089/public/home-crawler/info.log`  
