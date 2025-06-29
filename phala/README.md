# Phala Cloud Python Starter

[![](https://cloud.phala.network/deploy-button.svg)](https://cloud.phala.network/templates/python-starter)

This is a template for developing a [FastAPI](https://fastapi.tiangolo.com/)-based app with boilerplate code targeting deployment on [Phala Cloud](https://cloud.phala.network/) and [DStack](https://github.com/dstack-TEE/dstack/). It includes the SDK by default to make integration with TEE features easier. This repo also includes a default Dockerfile and docker-compose.yml for deployment.

## Development

In this tutorial, we'll start with venv and pip. First, you need to clone this repo:

```shell
git clone --depth 1 https://github.com/Phala-Network/phala-cloud-python-starter.git
```

Next, let's initialize the development environment with venv & pip:

```shell
python -m venv venv
source venv/bin/activate
python -m pip install -r requirements.txt
cp env.example .env
```

We also need to download the DStack simulator:

```shell
# Mac
wget https://github.com/Leechael/tappd-simulator/releases/download/v0.1.4/tappd-simulator-0.1.4-aarch64-apple-darwin.tgz
tar -xvf tappd-simulator-0.1.4-aarch64-apple-darwin.tgz
cd tappd-simulator-0.1.4-aarch64-apple-darwin
./tappd-simulator -l unix:/tmp/tappd.sock

# Linux
wget https://github.com/Leechael/tappd-simulator/releases/download/v0.1.4/tappd-simulator-0.1.4-x86_64-linux-musl.tgz
tar -xvf tappd-simulator-0.1.4-x86_64-linux-musl.tgz
cd tappd-simulator-0.1.4-x86_64-linux-musl
./tappd-simulator -l unix:/tmp/tappd.sock
```

Once the simulator is running, you need to open another terminal to start your FastAPI development server:

```shell
# Activate the Python venv
source venv/bin/activate

# Start the FastAPI dev server
python -m fastapi dev
```

By default, the FastAPI development server will listen on port 8000. Open http://127.0.0.1:8000/tdx_quote in your browser to get the quote with reportdata `test`.

## Build

You need to build the image and push it to DockerHub for deployment. The following instructions are for publishing to a public registry via DockerHub:

```shell
sudo docker build . -t leechael/phala-cloud-python-starter
sudo docker push leechael/phala-cloud-python-starter
```

## Deploy

You can copy and paste the `docker-compose.yml` file from this repo to see the example up and running.