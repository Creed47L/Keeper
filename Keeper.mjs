import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

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
        console.log(`File ${fileToBeAdded} added to Keeper with hash ${fileHash}`);
         
    }
}



(async () => {
    const keeper = new Keeper();
    await keeper.init(); // Ensures init() completes before moving on
})();