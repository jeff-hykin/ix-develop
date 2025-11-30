
<!--                                                          -->
<!--                                                          -->
<!-- DO NOT EDIT ME; EDIT ./build_helper/readme_workaround.md -->
<!--                                                          -->
<!--                                                          -->

## What is this?

A tool for fixing some issues with `nix develop`, like having [git lfs files being copied over and over to the nix store](https://discourse.nixos.org/t/is-it-possible-to-make-a-flake-that-has-no-source-tree/16037/6).

## How to install

Make sure you have nix installed:

```sh
curl --proto '=https' --tlsv1.2 -sSf -L https://install.determinate.systems/nix | sh -s -- install
```

Then install ix-develop:

```sh
nix-env -i -f https://github.com/jeff-hykin/ix-develop/archive/52d04d05d7094e64963316b1ce1ca8ea5c69acad.tar.gz
# or, if you have flakes:
nix profile install 'https://github.com/jeff-hykin/ix-develop/archive/52d04d05d7094e64963316b1ce1ca8ea5c69acad.tar.gz#ix-develop'
```

## How to use

Use as a mostly drop-in replacement for `nix develop`:

```sh
ix-develop
ix-develop --help
ix-develop --temp-dir .flake 
ix-develop --no-cache --temp-dir .flake

# nix develop passthrough:
ix-develop -- --version # == nix develop --version
ix-develop -- --pure
ix-develop -- --help
```

For quality of life you probably want to add the following to your devShell:

```nix
mkShell {
    shellHook = ''
        # when being run by ix-develop, cd into the real project
        if [ -d "$IX_DEVELOP_TARGET_PATH" ]; then
            cd "$IX_DEVELOP_TARGET_PATH"
        fi
    '';
}
```