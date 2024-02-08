bash:
	docker-compose exec xupopter_runner sh

start:
	docker-compose start

stop:
	docker-compose stop

restart:
	docker-compose restart

rebuild:
	docker-compose up -d --no-deps --build

logs:
	docker logs -f --tail 10 xupopter_runner
