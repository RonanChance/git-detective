<script lang="ts">
    import * as Accordion from "$lib/components/ui/accordion";
    import * as Popover from "$lib/components/ui/popover";
    import * as AlertDialog from "$lib/components/ui/alert-dialog";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button/index.js";
    import { Octokit } from 'octokit';
    import { tsCode } from "$lib/components/codesnippet/codesnippet.js";
    import { page } from '$app/stores'
    
    const octokit = new Octokit();
    let processing: boolean = false;
    let isToastVisible: boolean = false;
    let isDone: boolean = false;
    let isError: boolean = false;
    let abortController: AbortController | null = null;

    let username: string = $page.url.searchParams.get('q') || "";
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
            isDone = true;
        } catch (error) {
            handleSearchError(error);
        } finally {
            processing = false;
            abortController = null;
        } 
    }

    async function fetchRepositories(): Promise<string[]> {
        if (abortController === null) throw new Error("AbortController not initialized");
        
        try {
            const { data: repos } = await octokit.rest.repos.listForUser({ username, signal: abortController.signal });
            repoListLength = repos.length;
            return repos.map(repo => repo['commits_url'].slice(0, -6));
        } catch (error) {
            handleSearchError(error);
            throw new Error("Error fetching user repository list");
        }
    }

    async function processRepositories(repositories: string[]): Promise<void> {
        if (abortController === null) throw new Error("AbortController not initialized");

        for (const repo of repositories) {

            if (abortController.signal.aborted) throw new Error('AbortError');

            try {
                const response = await fetch(repo, { method: 'GET', headers: { 'Content-Type': 'application/json' }, signal: abortController.signal});
                if (!response.ok) throw new Error(`Error fetching repo: ${response.statusText}`);
                const data = await response.json();

                processCommits(data, repo);
                repoCounter += 1;

                await new Promise((resolve) => setTimeout(resolve, 2000));

                if (abortController.signal.aborted) throw new Error('AbortError');
            } catch (error) {
                handleSearchError(error);
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
        isError = false;
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
        isError = true;
    }

</script>

<div class="text-[var(--black)]">
    <div class="flex flex-col items-center mt-6">
        <div>
            <AlertDialog.Root open={isToastVisible}>
                <AlertDialog.Content>
                    <AlertDialog.Header>
                    <AlertDialog.Title>Oops!</AlertDialog.Title>
                    <AlertDialog.Description>
                        Something went wrong. Check the account name and try again.
                        <br />
                        Your rate limit resets each hour. 
                    </AlertDialog.Description>
                    </AlertDialog.Header>
                    <AlertDialog.Footer>
                    <AlertDialog.Action on:click={() => isToastVisible = false}>Continue</AlertDialog.Action>
                    </AlertDialog.Footer>
                </AlertDialog.Content>
                </AlertDialog.Root>
        </div>

        <img src="detective-octocat.png" alt="detective octocat" width="200px">
        <h1 class="text-center text-4xl font-extrabold leading-none tracking-tight text-[var(--black)] md:text-5xl lg:text-6xl dark:text-white">GitDetective</h1>
        <p class="italic text-center mt-2 px-6 font-normal text-gray-600 text-xl lg:text-2xl xl:px-48 dark:text-gray-400">A GitHub Alias Detection Software</p>
        
        <form class="flex w-full max-w-md mt-6 px-6 items-center space-x-2" on:submit|preventDefault={processing ? handleCancel : runSearch} data-lpignore="true" autocomplete="off">
            <Input type="text" placeholder="Username" bind:value={username} autocomplete="off" data-lpignore="true" data-form-type="other"/>
            <Button type="submit" class={processing ? 'bg-gray-500' : 'bg-[var(--black)]'}>
                {processing ? 'Cancel' : 'Search'}
            </Button>
        </form>

        <p class="text-center mt-6 px-6 font-normal text-black text-sm md:text-base lg:text-md">GitHub 
            <a class="underline break-word text-sm md:text-base lg:text-md" href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service" target="_blank" rel="noreferrer"> Terms of Service</a>: Use GitDetective Responsibly
            <br />Rate Limit: 60 Requests / Hour
        </p>

    </div>
    <div class="flex flex-col items-start px-8 gap-8 lg:px-[25%] text-xl mt-3">
        <div class="w-full">
            {#if processing}
                <div class="w-full">
                    <span class="loader"></span>
                </div>
            {:else if isDone}
                <div class="w-full">
                    <span class="loader-static bg-green-500"></span>
                </div>
            {:else if isError}
                <div class="w-full">
                    <span class="loader-static bg-red-500"></span>
                </div>
            {:else}
                <div class="w-full">
                    <span class="loader-static bg-gray-300"></span> 
                </div>
            {/if}
            <div class="flex flex-row justify-between w-full text-base lg:text-lg text-gray-600">
                <div> Commit: {commitCounter} </div>
                <div> Repository: {repoCounter} / {repoListLength} </div>
            </div>
        </div>

        <div class="w-full">
            <div class="flex flex-row gap-1">
                <h3 class="font-bold uta">Usernames</h3>
                <Popover.Root>
                    <Popover.Trigger><svg class="w-4 h-4 ml-0 text-gray-400 hover:text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg></Popover.Trigger>
                    <Popover.Content>Usernames attributed to the account</Popover.Content>
                </Popover.Root>
            </div>
            
            <div class="ml-2 pt-4">
                {#if Object.keys(usernameMapping).length}
                    {#each Object.entries(usernameMapping) as [u, link]}
                        <a class="underline decoration-0 break-all text-sm md:text-base lg:text-lg" href={link}>{u}</a> <br />
                    {/each}
                {/if}
            </div>

        </div>

        <div class="w-full">
            <div class="flex flex-row gap-1 ">
                <h3 class="font-bold">Emails</h3>
                <Popover.Root>
                    <Popover.Trigger><svg class="w-4 h-4 ml-0 text-gray-400 hover:text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg></Popover.Trigger>
                    <Popover.Content>Emails attributed to the account</Popover.Content>
                </Popover.Root>
            </div>
            <div class="ml-2 pt-4">
                {#if Object.keys(emailMapping).length}
                    {#each Object.entries(emailMapping) as [e, link]}
                        <a class="underline decoration-0 break-all text-sm md:text-base lg:text-lg" href={link}>{e}</a> <br />
                    {/each}
                {/if}
            </div>

        </div>

        <div class="w-full">
            <div class="flex flex-row gap-1">
                <h3 class="font-bold">Unknown</h3>
                <Popover.Root>
                    <Popover.Trigger><svg class="w-4 h-4 ml-0 text-gray-400 hover:text-gray-500" aria-hidden="true" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd"></path></svg></Popover.Trigger>
                    <Popover.Content>Emails/Usernames from authorless commits</Popover.Content>
                </Popover.Root>
            </div>
            <div class="ml-2 pt-4">
                {#if Object.keys(unknownMapping).length}
                    {#each Object.entries(unknownMapping) as [un, link]}
                        <a class="underline decoration-0 break-all text-sm md:text-base lg:text-lg" href={link}>{un}</a> <br />
                    {/each}
                {/if}
            </div>

        </div>
    </div>

    <div class="flex flex-col items-center px-8 mt-8 lg:px-[25%] text-lg">
        <Accordion.Root class="w-full">
            
            <Accordion.Item value="item-1">
            <Accordion.Trigger>Functionality</Accordion.Trigger>
                <Accordion.Content class="text-base">
                    Scan public GitHub commits to retrieve usernames and emails associated with an account.
                    <br />
                    <br />
                    Unauthenticted IP addresses can make 60 requests per hour.
                    <br />
                    <br />
                    Results must be used in accordance with GitHub's <a class="underline decoration-0 break-word" href="https://docs.github.com/en/site-policy/github-terms/github-terms-of-service" target="_blank" rel="noreferrer"> terms of service</a>.
                </Accordion.Content>
            </Accordion.Item>
            
            <Accordion.Item value="item-2">
                <Accordion.Trigger>How it Works</Accordion.Trigger>
                    <Accordion.Content class="text-base">
                    1. Fetches a list of public repositories from the user profile using the GitHub API.
                    <br />
                    <br />
                    2. Gets the 200 most recent commits for each public repository using the GitHub API.
                    <br />
                    <br />
                    3. Displays the username(s) and email(s) if the author matches the provided account name.  
                    <br />
                </Accordion.Content>
            </Accordion.Item>
            
            <Accordion.Item value="item-3">
                <Accordion.Trigger>Are Searches Private?</Accordion.Trigger>
                    <Accordion.Content class="text-base">
                    All requests are client-side, meaning GitHub will know your IP address. A VPN can cause requests to fail—use one at your own discretion.
                    <br />
                    <br />
                    Searches are between you and GitHub. This website is open-source, MIT-licensed, and does not collect search data. 
                </Accordion.Content>
            </Accordion.Item>

            <Accordion.Item value="item-4">
                <Accordion.Trigger>Can I See The Code?</Accordion.Trigger>
                    <Accordion.Content class="text-base">
                    Yes. You can visit <a href="https://github.com/RonanChance/git-detective" class="text-blue-600 underline" target="_blank">GitHub</a> to see more details.
                    <br />
                    <br />
                    The TypeScript code for this page is shown below:
                    <br />
                    <br />
                    <div class="bg-gray-100 rounded-sm whitespace-pre overflow-x-scroll text-sm md:text-base lg:text-lg">
                        {tsCode}
                    </div>
                </Accordion.Content>
            </Accordion.Item>
        
        </Accordion.Root>
    </div>

    <div class="flex flex-row w-full justify-center items-center mt-12 mb-14 gap-4">
        <a href="https://github.com/RonanChance/git-detective" target="_blank" data-value="github" style="border-radius:4px;" class="py-2 px-3 flex justify-center items-center bg-black hover:bg-gray-900 text-white transition ease-in duration-100 text-center text-base font-semibold shadow-md focus:outline-none">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" class="mr-2" viewBox="0 0 1792 1792">
              <path d="M896 128q209 0 385.5 103t279.5 279.5 103 385.5q0 251-146.5 451.5t-378.5 277.5q-27 5-40-7t-13-30q0-3 .5-76.5t.5-134.5q0-97-52-142 57-6 102.5-18t94-39 81-66.5 53-105 20.5-150.5q0-119-79-206 37-91-8-204-28-9-81 11t-92 44l-38 24q-93-26-192-26t-192 26q-16-11-42.5-27t-83.5-38.5-85-13.5q-45 113-8 204-79 87-79 206 0 85 20.5 150t52.5 105 80.5 67 94 39 102.5 18q-39 36-49 103-21 10-45 15t-57 5-65.5-21.5-55.5-62.5q-19-32-48.5-52t-49.5-24l-20-3q-21 0-29 4.5t-5 11.5 9 14 13 12l7 5q22 10 43.5 38t31.5 51l10 23q13 38 44 61.5t67 30 69.5 7 55.5-3.5l23-4q0 38 .5 88.5t.5 54.5q0 18-13 30t-40 7q-232-77-378.5-277.5t-146.5-451.5q0-209 103-385.5t279.5-279.5 385.5-103zm-477 1103q3-7-7-12-10-3-13 2-3 7 7 12 9 6 13-2zm31 34q7-5-2-16-10-9-16-3-7 5 2 16 10 10 16 3zm30 45q9-7 0-19-8-13-17-6-9 5 0 18t17 7zm42 42q8-8-4-19-12-12-20-3-9 8 4 19 12 12 20 3zm57 25q3-11-13-16-15-4-19 7t13 15q15 6 19-6zm63 5q0-13-17-11-16 0-16 11 0 13 17 11 16 0 16-11zm58-10q-2-11-18-9-16 3-14 15t18 8 14-14z"></path>
            </svg>
            View on GitHub
        </a>
    </div>
</div>

<style>

.loader-static {
    width: 100%;
    height: 4.8px;
    display: inline-block;
    position: relative;
    overflow: hidden;
}

.loader {
    width: 100%;
    height: 4.8px;
    display: inline-block;
    position: relative;
    background: #D1D5DB;
    overflow: hidden;
}

.loader::after {
    content: '';
    height: 4.8px;
    background: #000000;
    position: absolute;
    top: 0;
    left: 0;
    box-sizing: border-box;
    animation: animloader 1.5s linear infinite;
}

@keyframes animloader {
    0% {
        left:0%;
        right:100%;
        width:0%;
    }
    10% {
        left:0%;
        right:75%;
        width:35%;
    }
    90% {
        right:0%;
        left:75%;
        width:35%;
    }
    100% {
        left:100%;
        right:0%;
        width:0%;
    }
}

</style>
