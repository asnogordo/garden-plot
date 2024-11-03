# Garden Plot Discord Text game

Discord based text game themed for a garden

## Active bots

### PROD

### TEST
This is a test bot where new features should be deployed first before hitting production.


## Creating the bot

Out of the scope of this README, but in summary [something like this](https://www.writebots.com/discord-bot-token/) can show you the way.

## Setting up

1. Copy `.env.example` to `.env`.
2. Fill in the bot token you got when creating the bot in the previous step

## Running

### With Node

`npm start`

### With Docker

```bash
docker build . -t garden-plot
docker run -d --env-file .env garden-plot
```

To see the logs

```bash
# get the running CONTAINER ID
docker ps

docker logs <CONTAINER ID>
```

