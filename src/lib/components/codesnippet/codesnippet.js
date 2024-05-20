export const tsCode = `    <script lang="ts">
    import * as Accordion from "$lib/components/ui/accordion";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Octokit } from 'octokit';
    import { tsCode } from "$lib/components/codesnippet/codesnippet.js";
    import * as Popover from "$lib/components/ui/popover";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";

    const octokit = new Octokit();
    let processing: boolean = false;
    let isToastVisible: boolean = false;
    let isDone: boolean = false;
    let abortController: AbortController | null = null;

    let username: string = "";
    let usernameMapping: { [key: string]: string } = {};
    let emailMapping: { [key: string]: string } = {};
    let unknownMapping: { [key: string]: string } = {};

    let repoListLength: number = 0;
    let repoCounter: number = 0;
    let commitCounter: number = 0;

    async function runSearch(): Promise<void> {
        if (username === "") {
            isToastVisible = true;
            return;
        }

        if (processing) return;
        clearVariables();
        processing = true;
        abortController = new AbortController();

        try {
            const repositories = await fetchRepositories();
            await processRepositories(repositories);
        } catch (error) {
            handleSearchError(error);
        } finally {
            processing = false;
            abortController = null;
            if (repoListLength === repoCounter) isDone = true;
        } 
    }

    async function fetchRepositories(): Promise<string[]> {
        if (abortController === null) throw new Error("AbortController not initialized");
        const { data: repos } = await octokit.rest.repos.listForUser({ username, signal: abortController.signal });
        repoListLength = repos.length;
        return repos.map(repo => repo['commits_url'].slice(0, -6));
    }

    async function processRepositories(repositories: string[]): Promise<void> {
        if (abortController === null) throw new Error("AbortController not initialized");

        for (const repo of repositories) {

            if (abortController.signal.aborted) throw new Error('AbortError');

            try {
                const response = await fetch(repo, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: abortController.signal});
                if (!response.ok) throw new Error(\`Error fetching repo: \${response.statusText}\`);
                const data = await response.json();

                processCommits(data, repo);           
                repoCounter += 1;

                await new Promise((resolve) => setTimeout(resolve, 2000));

                if (abortController.signal.aborted) throw new Error('AbortError');
            } catch (error) {
                handleRepoProcessingError(error);
            }
        }
    }

    function processCommits(commits: any[], repo: string): void {
        for (const commit of commits) {
            if (abortController && abortController.signal.aborted) throw new Error('AbortError');

            const { name, email } = commit.commit.author;
            const login = commit.author?.login || null;

            if (!login) {
                unknownMapping[name] = repo;
                unknownMapping[email] = repo;
            } else if (login === username) {
                if (!(name in usernameMapping)) usernameMapping[name] = repo;
                if (!(email in emailMapping)) emailMapping[email] = repo;
            }

            commitCounter += 1;
        }
    }

    function clearVariables(): void {
        usernameMapping = {};
        emailMapping = {};
        unknownMapping = {};
        commitCounter = 0;
        repoCounter = 0;
        repoListLength = 0;
        isDone = false;
    }

    function handleCancel(): void {
        if (abortController) {
            abortController.abort();
            processing = false;
        }
    }

    function handleSearchError(error: any): void {
        if (error instanceof Error && error.message === 'AbortError') {
            console.log("Search aborted");
        } else {
            console.error("Error during search:", error);
            isToastVisible = true;
        }
    }

    function handleRepoProcessingError(error: any): void {
    if (error instanceof Error && error.message === 'AbortError') {
        throw new Error('AbortError');
    } else {
        console.error('Error processing repository:', error);
        isToastVisible = true;
    }
    }

    </script>
`;