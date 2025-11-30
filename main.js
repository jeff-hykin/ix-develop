import { FileSystem } from "https://deno.land/x/quickr@0.8.13/main/file_system.js"
import { parseArgs, flag, required, initialValue } from "https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/parse_args.js"
import { toCamelCase } from "https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/to_camel_case.js"
import { didYouMean } from "https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/flattened/did_you_mean.js"
import { version } from './tools/version.js'
import { compile } from "https://esm.sh/gitignore-parser@0.0.2"
import { Console, cyan, green, magenta, yellow } from "https://deno.land/x/quickr@0.8.12/main/console.js"
import $ from "https://esm.sh/@jsr/david__dax@0.43.2/mod.ts"
import { generateKeys, encrypt, decrypt, hashers } from "https://esm.sh/gh/jeff-hykin/good-js@1.18.2.0/source/encryption.js"
const $$ = (...args)=>$(...args).noThrow()

// FIXME: use the better gitignore parser (npm/ignore)

// 
// check for help/version
// 
const { help: showHelp, version: showVersion, } = parseArgs({
    rawArgs: Deno.args,
    fields: [
        [["--help",], flag,],
        [["--version"], flag,],
    ],
}).simplifiedNames
const highlightHelp = (string) => string.replace(
    // the [value]
    /(?<=\n    --(?:\w|-)+\s+)\[.+?\]/g, (match) => `${magenta(match)}`
).replace(
    // the Notes:
    /\n\w+:/g, (match) => `\n${yellow.bold(match)}`
).replace(
    // the --arg
    /\n    (--(?:\w|-)+)/g, (match) => `    ${green(match)}`
)
if (showVersion) {
    console.log(`v${version}`)
    Deno.exit(0)
}
if (showHelp) {
    console.log(highlightHelp(`
            Usage: 
                ${cyan`ix-develop`} [options] [...args] -- [...nix develop args]
            
            Options:
                --help
                    Show this help message
                --version
                    Show the version of ix-develop
                --no-cache
                    Hopefully this will never be needed
                --temp-dir
                    Defaults to .ix.ignore
        `.replace(/\n            /g, "\n")))
    Deno.exit(0)
}

// 
// normal usage
// 
const parsedArgs = parseArgs({
    rawArgs: Deno.args,
    fields: [
        [["--no-cache",], flag,],
        [["--temp-dir",], initialValue(`.ix.ignore`),],
        // [[1, "--deno-version"], initialValue(`${Deno.version.deno}`), ],
        // [["--no-default-args"], flag, ],
        // [["--add-arg"], initialValue([]), ],
        // [["--add-unix-arg"], initialValue([]), ],
        // [["--add-windows-arg"], initialValue([]), ],
    ],
    nameTransformer: toCamelCase,
    namedArgsStopper: "--",
    nameRepeats: "useLast",
    valueTransformer: JSON.parse,
    isolateArgsAfterStopper: false,
    argsByNameSatisfiesNumberedArg: true,
    implicitNamePattern: /^(--|-)[a-zA-Z0-9\-_]+$/,
    implictFlagPattern: null,
})
didYouMean({
    givenWords: Object.keys(parsedArgs.implicitArgsByName).filter(each => each.startsWith(`-`)),
    possibleWords: Object.keys(parsedArgs.explicitArgsByName).filter(each => each.startsWith(`-`)),
    autoThrow: true,
})

// console.debug(`parsedArgs is:`,parsedArgs)
const {
    noCache,
    tempDir,
} = parsedArgs.simplifiedNames

// console.log(`looking for flake.nix`)
const parentPath = await FileSystem.walkUpUntil("flake.nix")
if (!parentPath) {
    throw Error(`I couldn't find a flake.nix file in this directory or any of its parents`)
}
let lockFileExistsPromise = FileSystem.exists(`${parentPath}/flake.lock`)
let flakeignorePromise = FileSystem.read(`${parentPath}/.flakeignore`)

// 
// somewhere to put the real git repo
// 
// console.log(`checking for cache folder`)
const cachePath = `${tempDir}/${(await hashers.sha256(parentPath)).slice(0,36)}`
if (noCache) {
    await FileSystem.remove(cachePath)
}
await FileSystem.ensureIsFolder(cachePath)
// console.log(`checking for cache folder: ${cachePath}`)


// so that dev shells can find the real project
Deno.env.set(`IX_DEVELOP_TARGET_PATH`, parentPath)

// 
// create git repo
// 
let gitInitProcess = Promise.resolve({ code: 0 })
FileSystem.pwd = cachePath
if (!FileSystem.exists(`${cachePath}/.git`)) {
    gitInitProcess = $`git init`.spawn()
}


// 
// 
// copy (symlink) into temp repo
// 
// 

let fileCopyPromises = []

// 
// copy special files 
// 
let ignoreTool = compile("")
if (typeof (await flakeignorePromise) == "string") {
    ignoreTool = compile(await flakeignorePromise)
    // copy over the .flakeignore
    fileCopyPromises.push(FileSystem.relativeLink({
        existingItem: `${parentPath}/.flakeignore`,
        newItem: `${cachePath}/.flakeignore`,
        force: true,
        allowNonExistingTarget: false,
        overwrite: true,
    }))
}
if (await lockFileExistsPromise) {
    // nix doesn't like it when the flake.lock is a symlink
    await FileSystem.copy({ from: `${parentPath}/flake.lock`, to: `${cachePath}/flake.lock`, overwrite: true, })
}

// 
// link/copy generic files
// 
// TODO: in the future, if parentPath is a git repo, we could potentially link as needed
const filesToSymlink = (await FileSystem.listFilePathsIn(
    parentPath,
    {
        recursively: true,
        searchOrder: 'breadthFirstSearch',
        dontFollowSymlinks: true,
        dontReturnSymlinks: false,
        shouldntInclude: (path)=>{
            const out = path.endsWith(`/.git`) || path == `.git` || path == `${parentPath}/flake.lock` || FileSystem.makeAbsolutePath(tempDir) == FileSystem.makeAbsolutePath(path)
            if (out) {
                console.debug(`out is:`,path)
            }
            // console.debug(`each path is:`,path)
            return out
        },
        shouldntExplore: (path)=>{
            // console.debug(`path is:`,path)
            return FileSystem.makeAbsolutePath(path) == FileSystem.makeAbsolutePath(`${parentPath}/.git`)
        },
    }
)).map(
    path => FileSystem.makeRelativePath({ from: parentPath, to: path })
).filter(
    ignoreTool.accepts
)

// symlink everything
await Promise.all(fileCopyPromises.concat(filesToSymlink.map(
    each => {
        // git doesn't link it when .gitignore is a symlink
        if (FileSystem.basename(each) == ".gitignore") {
            return FileSystem.copy({ from: `${parentPath}/${each}`, to: `${cachePath}/${each}`, overwrite: true, })
        } else {
            return FileSystem.relativeLink({
                existingItem: `${parentPath}/${each}`,
                newItem: `${cachePath}/${each}`,
                force: true,
                allowNonExistingTarget: false,
                overwrite: true,
            })
        }
    }
)))

await gitInitProcess

// stage even the stuff that was normally gitignored
await $$`git add -A -f && git commit -m "-"`.cwd(cachePath).text("combined")


// in the future
    // add "fast" option to just re-init env vars
    // add option to fill data into the flake.nix
    // add an option to sidestep the init of the bash / shell that is started by nix develop by creating a shim

const { code } = await $`nix develop ${parsedArgs.argsAfterStopper}`.cwd(cachePath)
Deno.exit(code)