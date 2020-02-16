# ![alt tag](https://github.com/cusac/mbt.guide/blob/master/src/routes/Home/logo-wide.png)

This is the backend for the mbt.guide projects. The code is based off of the backend portion of the [appy](https://appyapp.io/) app which heavliy utilizes the [rest-hapi](https://resthapi.com/) plugin for the [hapi](https://hapi.dev/) framework, which means MongoDB is used as a datastore. Please reference the docs for these tools for details.


## Readme contents
- [Requirements](#requirements)
- [Installation](#installation)
- [Configuration](#configuration)
- [First time setup](#first-time-setup)
- [Running the backend](#running-the-backend)
- [License](#license)


## Requirements

You need [Node.js](https://nodejs.org/en/) (>=8.10.0) installed and you'll need access to a [MongoDB](https://docs.mongodb.com/manual/installation/) database.

[Back to top](#readme-contents)

## Installation

```
$ git clone https://github.com/cusac/mbt.guide-backend.git
$ cd mbt.guide-backend
$ npm install
```

[Back to top](#readme-contents)

## Configuration

- Copy .env-sample to .env and edit as needed. Don't commit .env to your repository.

## First time setup
**WARNING**: This will clear all data in the following MongoDB collections (in the db defined in ``restHapiConfig.mongo.URI``, default ``mongodb://localhost/appy``) if they exist: ``user``, ``role``, ``group``, ``permission``, ``session``, and ``authAttempt``.

If you would like to seed your database with some data, run:

```
$ npm run seed
```

NOTE: The password for all seed users is ``root``.

[Back to top](#readme-contents)

## Running the backend

To quickly run the app locally, simply run:

```
$ npm start
```


Once the app is running point your browser to http://localhost:8080/ to view the Swagger docs.

[Back to top](#readme-contents)

## Testing

Currently the majority of the backend tests are e2e tests that rely heavily on scripts and docker
compose. These can be found in `test/e2e`. 

To run these tests run (from the root directory):
```bash
bash run_e2e.tests.sh
```

## License
MIT

[Back to top](#readme-contents)
