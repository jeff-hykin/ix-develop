
<!--                                                          -->
<!--                                                          -->
<!-- DO NOT EDIT ME; EDIT ./build_helper/readme_workaround.md -->
<!--                                                          -->
<!--                                                          -->

## What is this?

## How to install

Make sure you have nix installed:

```sh
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

Then install ix-develop:

```sh
nix-env -i -f https://github.com/jeff-hykin/ix-develop/archive/8e541887f7b1168c51125db7ac303e3695ff0be8.tar.gz
# or, if you have flakes:
nix profile install 'https://github.com/jeff-hykin/ix-develop/archive/8e541887f7b1168c51125db7ac303e3695ff0be8.tar.gz#ix-develop'
```

## How to use

