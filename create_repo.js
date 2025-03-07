// File: create_repo.js

const axios = require('axios');

// Accept command-line arguments.
const [,, projectId, englishName, gitHubPAT, gitHubUser] = process.argv;

if (!projectId || !englishName || !gitHubPAT || !gitHubUser) {
    console.error("Usage: node create_repo.js <projectId> <englishName> <gitHubPAT> <gitHubUser>");
    process.exit(1);
}

// Sanitize the English name: lowercase and replace spaces with hyphens.
const repoName = englishName.trim().toLowerCase().replace(/\s+/g, '-');

async function repoExists() {
    const url = `https://api.github.com/repos/${gitHubUser}/${repoName}`;
    try {
        const response = await axios.get(url, { 
            headers: { 
                Authorization: `token ${gitHubPAT}`, 
                Accept: "application/vnd.github.v3+json" 
            }
        });
        return response.status === 200;
    } catch (error) {
        if (error.response && error.response.status === 404) {
            return false;
        } else {
            console.error("Error checking repository existence:", error.message);
            process.exit(1);
        }
    }
}

async function createRepo() {
    const url = `https://api.github.com/user/repos`;
    const payload = {
        name: repoName,
        private: true,
        description: `Repository for GAS project (ID: ${projectId}) - ${englishName}`
    };

    try {
        const response = await axios.post(url, payload, { 
            headers: { 
                Authorization: `token ${gitHubPAT}`, 
                Accept: "application/vnd.github.v3+json" 
            }
        });
        console.log(`Repository "${repoName}" created successfully.`);
    } catch (error) {
        // If repository exists, a 422 error may occur.
        if (error.response && error.response.status === 422) {
            console.log(`Repository "${repoName}" already exists.`);
        } else {
            console.error("Error creating repository:", error.response ? error.response.data : error.message);
            process.exit(1);
        }
    }
}

async function main() {
    if (await repoExists()) {
        console.log(`Repository "${repoName}" already exists.`);
    } else {
        await createRepo();
    }
}

main();
