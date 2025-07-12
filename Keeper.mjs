import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { diffLines } from 'diff';
import chalk from 'chalk';
import { Command } from 'commander';

const program = new Command();

class Keeper{

    constructor(repoPath = '.'){
        this.repoPath = path.join(repoPath, '.keeper');
        this.objectsPath = path.join(this.repoPath, 'objects'); //  .keeper/objects
        this.headPath = path.join(this.repoPath, 'HEAD');  //  .keeper/HEAD
        this.indexPath = path.join(this.repoPath, 'index'); // .keeper/index
        this.init();
    }
    
    async init () {
        await fs.mkdir(this.objectsPath, {recursive: true});
        try {
            await fs.writeFile(this.headPath, '', {flag: 'wx'}); //wx: write if not existing or give error if existing.
            await fs.writeFile(this.indexPath, JSON.stringify([]), {flag: 'wx'});
        } catch (error) {
            console.log("Already initialised .Keeper folder");
        }
    }

    hashObject (content) {
        return crypto.createHash('sha1').update(content, 'utf-8').digest('hex');
    }

    async add(fileToBeAdded) {
        // fileToBeAdded: path to the file to be added 
        const fileData = await fs.readFile(fileToBeAdded, {encoding: 'utf-8'});
        const fileHash = this.hashObject(fileData);
        console.log(fileHash); 
        const newFileHashedObjectPath = path.join(this.objectsPath, fileHash);
        await fs.writeFile(newFileHashedObjectPath, fileData);
        await this.updateStagingArea(fileToBeAdded, fileHash);
        console.log(`File ${fileToBeAdded} added to Keeper with hash ${fileHash}`);
         
    }

    async updateStagingArea(filePath, fileHash) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' })); // read the index file
        index.push({ path : filePath, hash: fileHash }); // add the file to the index
        await fs.writeFile(this.indexPath, JSON.stringify(index)); // write the updated index file
    }

    async commit(message) {
        const index = JSON.parse(await fs.readFile(this.indexPath, { encoding: 'utf-8' }));
        const parentCommit = await this.getCurrentHead();

        const commitData = {
            timeStamp: new Date().toISOString(),
            message,
            files: index,
            parent: parentCommit
        };

        const commitHash = this.hashObject(JSON.stringify(commitData));
        const commitPath = path.join(this.objectsPath, commitHash);
        await fs.writeFile(commitPath, JSON.stringify(commitData));
        await fs.writeFile(this.headPath, commitHash); // update the HEAD to point to the new commit
        await fs.writeFile(this.indexPath, JSON.stringify([])); // clear the staging area
        console.log(`Commit successfully created: ${commitHash}`); 

    }

    async getCurrentHead() {
        try {
            return await fs.readFile(this.headPath, { encoding: 'utf-8' });
        } catch(error) {
            return null;
        }
    }

    async log() {
        let currentCommitHash = await this.getCurrentHead();;
        while(currentCommitHash) {
            const commitData = JSON.parse(await fs.readFile(path.join(this.objectsPath, currentCommitHash), { encoding: 'utf-8' }));
            console.log(`---------------------\n`)
            console.log(`Commit: ${currentCommitHash}\nDate: ${commitData.timeStamp}\n\n${commitData.message}\n\n`);

            currentCommitHash = commitData.parent;
        }
    }

    async showCommitDiff(commitHash) {
        const commitData = JSON.parse(await this.getCommitData(commitHash));
        if(!commitData) {
            console.log("Commit not found");
            return;
        }
        console.log("Changes in the last commit are: ");

        for(const file of commitData.files) {
            console.log(`File: ${file.path}`);
            const fileContent = await this.getFileContent(file.hash);
            console.log(fileContent);

            if(commitData.parent) {
                // get the parent commit data
                const parentCommitData = JSON.parse(await this.getCommitData(commitData.parent));
                const getParentFileContent = await this.getParentFileContent(parentCommitData, file.path);
                if(getParentFileContent !== undefined) {
                    console.log('\nDiff:');
                    const diff = diffLines(getParentFileContent, fileContent);

                    // console.log(diff);

                    diff.forEach(part => {
                        if(part.added) {
                            process.stdout.write(chalk.green("++" + part.value));
                        } else if(part.removed) {    
                            process.stdout.write(chalk.red("--" + part.value));
                        } else {
                            process.stdout.write(chalk.grey(part.value));
                        }
                    });
                    console.log(); // new line
                } else {
                    console.log("New file in this commit");
                }

            } else {
                console.log("First commit");
            }

        }
    }

    async getParentFileContent(parentCommitData, filePath) {
        const parentFile = parentCommitData.files.find(file => file.path === filePath);
        if(parentFile) {
            // get the file content from the parent commit and return the content
            return await this.getFileContent(parentFile.hash);
        }
    }

    async getCommitData(commithash) {
        const commitPath = path.join(this.objectsPath, commithash);
        try {
            return await fs.readFile(commitPath, { encoding: 'utf-8'});
        } catch(error) {
            console.log("Failed to read the commit data", error);
            return null;
        }
    }

    async getFileContent(fileHash) {
        const objectPath = path.join(this.objectsPath, fileHash);
        return fs.readFile(objectPath, { encoding: 'utf-8' });
    }
}



//(async () => {
//    const keeper = new Keeper();
//    await keeper.init(); // Ensures init() completes before moving on
//})();
program.command('init').action(async () => {
    const keeper = new Keeper();
});

program.command('add <file>').action(async (file) => {
    const keeper = new Keeper();
    await keeper.add(file);
});

program.command('commit <message>').action(async (message) => {
    const keeper = new Keeper();
    await keeper.commit(message);
});

program.command('log').action(async () => {
    const keeper = new Keeper();
    await keeper.log();
});

program.command('show <commitHash>').action(async (commitHash) => {
    const keeper = new Keeper();
    await keeper.showCommitDiff(commitHash);
});

program.parse(process.argv);
