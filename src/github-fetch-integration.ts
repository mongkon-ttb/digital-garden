import nodePath, { parse, sep } from "node:path"
import fs, { copyFileSync } from "node:fs"
import { globSync } from "glob"
import { rimrafSync } from "rimraf"
import matter from "gray-matter"
import { Octokit } from "octokit"
import { PassThrough, Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import { Parse, type ReadEntry } from "tar"

type TarFilter = (path: string, entry: ReadEntry) => boolean

async function* readTar(input: Readable, filter: TarFilter) {
  const entryStream = new PassThrough({ objectMode: true })
  const pipelinePromise = pipeline(
    input,
    new Parse({
      filter,
      onentry: async (entry) => {
        entryStream.write(entry)
      },
    })
  ).then(() => {
    entryStream.end()
  })
  for await (const entry of entryStream) {
    const buffers: Buffer[] = []
    for await (const data of entry) {
      buffers.push(data)
    }
    const content = Buffer.concat(buffers)
    yield { entry, content }
  }
  await pipelinePromise
}


export async function fetchSecondBrain() {

    console.log("Fetching files from the second brain...")

    const octokit = new Octokit()
   
    const downloadResponse = await octokit.rest.repos.downloadTarballArchive({
      owner : "mongkon-ttb",
      repo : "second-brain",
      ref: "main",
    })

    rimrafSync("./tmp/second-brain")
    fs.mkdirSync("./tmp/second-brain", { recursive: true })

    let data = Buffer.from(downloadResponse.data as ArrayBuffer)

    const passThroughStream = new PassThrough()
    passThroughStream.end(data)

    const fileFilter: TarFilter = (path, entry) => {
      if (entry.type === "Directory") return false

      const p = `/${pathWithoutTopmostDir(path)}`

      if (
        p.includes("LICENSE") ||
        p.includes("README") 
      )
        return false

      return true
    }

    const pathWithoutTopmostDir = (path: string) => {
      const pathObj = parse(path)
      const dirParts = pathObj.dir.split(sep).slice(1)
      return nodePath.join(...dirParts, pathObj.base)
    }

    for await (const item of readTar(passThroughStream, fileFilter)) {
      const content = item.content
      const path = pathWithoutTopmostDir(item.entry.path)

      // Write to file
      const destinationPath = `./tmp/second-brain/${path}`
      const destinationDir = nodePath.dirname(destinationPath)
      if (!fs.existsSync(destinationDir)) {
        await fs.promises.mkdir(destinationDir, { recursive: true })
      }

      await fs.promises.writeFile(destinationPath, content)
    }

    data = Buffer.from("") // Free memory
  
  rimrafSync("./public/images/*", { glob: true })
  rimrafSync("./src/content/second-brain/*", { glob: true })

  const slugs: string[] = []
  
  globSync("./tmp/second-brain/**/*.{md,mdx,svx}")


    .forEach((path) => {
      try {
        const file = matter.read(path)

        if (1+1 === 2) {
          const destinationPath = `./src/content/second-brain/${path
            .split("/")
            .slice(2)
            .join("/")}`
          const destinationDir = nodePath.dirname(destinationPath)

       
          slugs.push(file.data.slug)

          console.log("Copy", path, "to", destinationPath)

          // Create the destination directory if it doesn't exist
          if (!fs.existsSync(destinationDir)) {
            fs.mkdirSync(destinationDir, { recursive: true })
          }

          copyFileSync(path, destinationPath)

         
        }
      } catch (e) {
        console.error(e)
      }
    })

  console.log("Done fetching files from the second brain")
}



