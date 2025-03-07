#!/bin/bash
# File: auto_deploy.sh
# make sure to make the script executable chmod +x auto_deploy.sh

# Base directory where your GAS projects will be stored.
BASE_DIR="$HOME/gas-projects"
mkdir -p "$BASE_DIR"

# Path to your CSV file listing projects (format: project_id,english_project_name)
PROJECTS_FILE="$HOME/gas-auto-deploy/projects.txt"

# GitHub credentials – DO NOT hardcode confidential information in public repos.
# Replace these placeholders with your own, or use environment variables.
GITHUB_USER="your_github_username"
GITHUB_PAT="your_personal_access_token_here"

# Function to sanitize the English project name for use as a GitHub repo name.
sanitize_repo_name() {
  echo "$1" | tr '[:upper:]' '[:lower:]' | sed -e 's/ /-/g' -e 's/[^a-z0-9-]//g'
}

# Function to create a GitHub repository using create_repo.js.
create_github_repo() {
    local project_id="$1"
    local english_name="$2"
    node "$HOME/gas-auto-deploy/create_repo.js" "$project_id" "$english_name" "$GITHUB_PAT" "$GITHUB_USER"
}

# Process each project from the projects.txt file.
while IFS=, read -r project_id english_name; do
    # Skip empty lines and lines missing fields.
    if [[ -z "$project_id" || -z "$english_name" ]]; then
        continue
    fi

    english_name=$(echo "$english_name" | xargs) # trim whitespace
    echo "--------------------------------"
    echo "Processing project: $project_id - $english_name"

    # Create project folder named by project ID.
    project_dir="$BASE_DIR/$project_id"
    mkdir -p "$project_dir"
    cd "$project_dir" || { echo "Cannot enter directory $project_dir"; exit 1; }

    # Clone or update the GAS project using clasp.
    if [ ! -f "appsscript.json" ]; then
       echo "Cloning project via clasp..."
       clasp clone "$project_id"
    else
       echo "Pulling latest code via clasp..."
       clasp pull
    fi

    # Determine repo name from the English project name.
    repo_name=$(sanitize_repo_name "$english_name")

    # Create the GitHub repository automatically via the GitHub API.
    create_github_repo "$project_id" "$english_name"

    # AUTOMATE INITIAL GIT SETUP:
    if [ ! -d ".git" ]; then
        echo "Initializing Git repository for project $project_id"
        git init
        git remote add origin "https://${GITHUB_PAT}@github.com/${GITHUB_USER}/${repo_name}.git"
        git add .
        git commit -m "Initial commit"
        git push -u origin master
    else
        # Update remote URL to ensure it uses the PAT and the proper repo name.
        git remote set-url origin "https://${GITHUB_PAT}@github.com/${GITHUB_USER}/${repo_name}.git"
    fi

    # Run the deploy.js script to update README.md if there are changes.
    node "$HOME/gas-auto-deploy/deploy.js"

    cd "$BASE_DIR" || exit
done < "$PROJECTS_FILE"

echo "All projects processed."
