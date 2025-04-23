import { Call, ConnectedUser, ConnectionServiceEvents, ConnectionState, Conversation, LogLevelEnum, RainbowSDK, RBEvent, User, BubbleService, BubbleServiceEvents, Bubble, BubbleConference, BubbleConferenceEvents, BubbleConferenceParticipant, BubbleConferenceMedia, BubbleConferenceMediaAction, BubbleConferenceServiceEvents, BubblesPlugin, BubbleConferencePlugin, BubbleSearchResult } from 'rainbow-web-sdk';

// Personnal configuration for the SDK APP; If you need help, please read the starting guides on how to obtain the key / secret
// and update the appConfig in the config file.
import { appConfig } from './config/config';


// import { appConfig } from './config/myConfig';

class TestApplication {
    protected rainbowSDK: RainbowSDK;

    private connectedUser: ConnectedUser;

    //reference to the bubble conference object
    private bubbleConference: BubbleConference;

    //to beo unsubscribed on log-out to avoid memory leak
    private bubbleSubscription;
    private bubbleConferenceSubscription;

    constructor() {
    }

    public async init() {
        if (appConfig?.applicationId === "applicationId" || appConfig?.secretKey === "secretKey") {
            window.alert("No application ID or secret key are set for this application ! Refer to the README file");
            return;
        }

        this.rainbowSDK = RainbowSDK.create({
            appConfig: {
                server: appConfig.server,
                applicationId: appConfig.applicationId,
                secretKey: appConfig.secretKey
            },
            plugins: [BubblesPlugin, BubbleConferencePlugin],
            autoLogin: true,
            logLevel: LogLevelEnum.WARNING
        });

        this.rainbowSDK.connectionService.subscribe((event: RBEvent) =>
            this.connectionStateChangeHandler(event), ConnectionServiceEvents.RAINBOW_ON_CONNECTION_STATE_CHANGE);


        // Show the loading spinner
        document.getElementById('loading-spinner').style.display = 'block';

        this.connectedUser = await this.rainbowSDK.start();

        //hide loading spinner
        document.getElementById('loading-spinner').style.display = 'none';

        this.managePage();
    }

    private managePage() {
        if (!this.connectedUser) {
            document.getElementById('loginContainer').style.display = 'block';
            document.getElementById('mainPage').style.display = 'none';
            //show your login page here
            this.manageLoginForm();
        }
        else {
            this.showMainPage();
        }
    }

    private connectionStateChangeHandler(event: RBEvent): void {
        const connectionState: ConnectionState = event.data;
        console.info(`[testAppli] onConnectionStateChange ${connectionState.state}`);
    }

    private manageLoginForm() {
        const form = document.getElementById('loginForm') as HTMLFormElement;
        const usernameInput = document.getElementById('username') as HTMLInputElement;
        const passwordInput = document.getElementById('password') as HTMLInputElement;
        const errorMessage = document.getElementById('error-message') as HTMLParagraphElement;

        // Handle form submission
        form.addEventListener('submit', async (event) => {
            event.preventDefault();

            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                // Show error if any field is empty
                errorMessage.textContent = 'Both fields are required!';
            } else {
                // Show the loading spinner
                document.getElementById('loginContainer').style.display = 'none';
                document.getElementById('loading-spinner').style.display = 'block';
                try { this.connectedUser = await this.rainbowSDK.connectionService.logon(username, password, true); }
                catch (error: any) {
                    document.getElementById('loginContainer').style.display = 'block';
                    console.error(`[testAppli] ${error.message}`);
                    alert(`Login error for ${username}`);
                    return;
                }
                // Clear error message and simulate login
                errorMessage.textContent = '';

                //hide loading spinner
                document.getElementById('loading-spinner').style.display = 'none';

                this.showMainPage();
            }
        });
    }

    private showMainPage() {
        document.getElementById('loginContainer').style.display = 'none';
        document.getElementById('mainPage').style.display = 'flex';
        const usernameElement = document.getElementById('username');
        const companyElement = document.getElementById('company');
        const avatarElement: any = document.getElementById('avatar');

        const logoutButton = document.getElementById('logout-btn');
        logoutButton.addEventListener('click', async () => {
            await this.rainbowSDK.connectionService.logout();
            /** should be managed by the events received here but I take a shortcut
             * this.rainbowSDK.connectionService.subscribe((event: RBEvent) =>
                this.connectionStateChangeHandler(event), ConnectionServiceEvents.RAINBOW_ON_CONNECTION_STATE_CHANGE);
             * 
            */

            this.connectedUser = undefined;
            this.managePage();
        });

        usernameElement.textContent = this.connectedUser.displayName;
        companyElement.textContent = this.connectedUser.companyInfo?.name;
        avatarElement.src = this.connectedUser.avatar?.src;

        this.manageBubbles();

        const searchQueryInput: any = document.getElementById('search-query');
        const searchButton = document.getElementById('search-btn');
        const searchResultsContainer = document.getElementById('search-results');

        // Handle search functionality
        searchButton.addEventListener('click', async () => {
            const searchQuery = searchQueryInput.value.trim();
            searchResultsContainer.innerHTML = '';

            if (!searchQuery) {
                alert('Please enter a search query.');
                return;
            }
            const bubbleResult: BubbleSearchResult[] = await this.rainbowSDK.bubbleService.searchBubbles(searchQuery);

            //to keep it simple, we get only the first X results and we get the bubbles inside;
            const bubbles = bubbleResult.slice(0, 3).map((result) => result.bubble);

            bubbles.forEach(bubble => {
                const resultCard = document.createElement('div');
                resultCard.classList.add('result-card');

                resultCard.innerHTML = `
                    <img src="${bubble.avatar}" alt="Avatar" />
                    <h4>${bubble.name}</h4>
                    <button class="call-btn">Start conference</button>
                `;

                searchResultsContainer.appendChild(resultCard);

                const callButton = resultCard.querySelector('.call-btn');
                if (callButton) {
                    callButton.addEventListener('click', () => this.startConference(bubble));
                }
            });
        });
    }

    /**
     * NOTE: You should check if the bubbles has already conference inside, if we can actually start one, etc;
     * 
     */
    public async startConference(bubble: Bubble) {
        const searchResultsContainer = document.getElementById('search-results');
        searchResultsContainer.innerHTML = '';

        //start or join bubble
        try {
            if (bubble.isBubbleConferenceStarted()) {
                //there's already a conference here, directly join it; (avoid to join the same conference ... )
                this.bubbleConference = this.rainbowSDK.bubbleConferenceService?.getConference(bubble);
                await this.bubbleConference.join();
            }
            else if (bubble.isConnecteUserOwner() || bubble.isConnecteUserOrganizer()) {
                //the start does not make a join, we can start a conference but without joining it;
                this.bubbleConference = await this.rainbowSDK.bubbleConferenceService?.startConference(bubble);

                //join it too
                await this.bubbleConference.join();
            }

            if (!this.bubbleConference) {
                //show some error as user does not have rights or something
                return;
            }

            this.subscribeForConferenceUpdates();
        }
        catch (error) {
            //manage error
        }
    }


    /**
     * Here we can list for all bubbles events if we want to. For this example, all we want to know is WHEN we can use the bubbles, so that
     * we can add a search for existing bubbles and listen for any conference changes;
     */
    private manageBubbles() {
        if (this.rainbowSDK.bubbleService.started) {
            this.manageBubbleSearchAndConferences();
        }
        else {
            this.bubbleSubscription = this.rainbowSDK.bubbleService.subscribe((event: RBEvent<BubbleServiceEvents>) => {
                try {
                    switch (event.name) {
                        case BubbleServiceEvents.ON_SERVICE_STARTED:
                            this.manageBubbleSearchAndConferences();
                            break;

                        default:
                            break;
                    }
                }
                catch (error) {
                    //do something 
                }
            });
        }

    }

    /**
     * Bubbles are ready to be used. We can add the search for bubbles, the start conference call, 
     * but also the list of bubbles with active conferences where we can join
     */
    private async manageBubbleSearchAndConferences() {
        //all bubbles are loaded, we can already find the ones that have active conference inside;

        //we can get all bubbles with active conferences inside and show them, if we want to 
        /*
         * const activeConferenceBubbles = await this.rainbowSDK.bubbleService.getBubbles('WITH_CONFERENCE');
        */

        //do something with them ...

        //here we'll only listen for new conference, or end of conference;
        //do not forget to unsubscribe on log-out, or on page change, as this may cause memory leak !
        const bubbleConferenceServiceSubscription = this.rainbowSDK.bubbleConferenceService?.subscribe((event: RBEvent) => {
            switch (event.name) {
                case BubbleConferenceServiceEvents.ON_CONFERENCE_STARTED:
                    // This event is fired for all bubble when a new conference has been started.
                    // You can retrieve the new conference in event data
                    if (!this.bubbleConference) {
                        //we've no active bubble conference, we can show this new bubble and join it if we want to;

                        //to keep it simple, I'll manage only one new started conference inside the search results and we can join it;
                        const bubbleConf: BubbleConference = event.data.bubbleConference;

                        //ignore my conference
                        if (bubbleConf.isMyConference) return;

                        const searchResultsContainer = document.getElementById('search-results');

                        //remove all elements inside and add new one
                        searchResultsContainer.innerHTML = '';

                        const resultCard = document.createElement('div');
                        resultCard.classList.add('result-card');

                        resultCard.innerHTML = `
                            <img src="${bubbleConf.bubble?.avatar}" alt="Avatar" />
                            <h4>${bubbleConf.bubble?.name}</h4>
                            <button class="call-btn">Join conference</button>
                        `;

                        searchResultsContainer.appendChild(resultCard);

                        const callButton = resultCard.querySelector('.call-btn');
                        if (callButton) {
                            callButton.addEventListener('click', async () => {
                                searchResultsContainer.innerHTML = '';
                                this.bubbleConference = bubbleConf;
                                await bubbleConf.join();
                                this.subscribeForConferenceUpdates();
                            });
                        }
                    }
                    break;
                case BubbleConferenceServiceEvents.ON_CONFERENCE_ENDED:
                    // This event is fired for all bubble member when a existing conference is ended. 
                    // You can retreive the ended conference in event data 

                    //update UI to remove bubble from the list of bubbles with active conferences;

                    //I remove all items in the list... dont do this :)
                    document.getElementById('search-results').innerHTML = '';

                    break;
                default:
                    break;
            }
        });
    }


    /**
     * FUNCTIONS FOR
     * MANAGEMENT OF ACTIVE BUBBLE CONFERENCE
     */


    private buildCell(participant: BubbleConferenceParticipant) {

        //check if participant is already there, do nothing
        let cardElement = document.getElementById(participant.id);
        if (cardElement) return;

        const callCardsContainer: any = document.getElementById('call-cards-container');

        //create my participant
        cardElement = document.createElement('div');
        //give ID to the card
        cardElement.id = participant.id;
        cardElement.classList.add('call-card');

        cardElement.innerHTML = `
            <img src="${participant.contact?.avatar?.src}" alt="Avatar" />
            <video id="video_${cardElement.id}" width=240 height=135 class="hidden"></video>
            <h4>${participant.contact?.displayName}</h4>
            <button class="call-end-btn hidden">End</button>
            <button class="mute-btn hidden">Mute</button>
            <button class="unmute-btn hidden">Unmute</button>
            <button class="add-video-btn hidden">Add Video</button>
            <button class="remove-video-btn hidden">Remove Video</button>
        `;


        callCardsContainer.appendChild(cardElement);

        //manage my buttons
        if (participant.id !== this.connectedUser.dbId) return;

        const callButton = cardElement.querySelector('.call-end-btn');
        if (callButton) {
            callButton.addEventListener('click', () => {
                if (this.bubbleConference.isMyConference) this.bubbleConference.stop();
                else this.bubbleConference.leave();
            });
        }

        callButton.classList.toggle("hidden", false);

        const muteButton = cardElement.querySelector('.mute-btn');
        if (muteButton) {
            muteButton.addEventListener('click', () => this.bubbleConference.mute());
        }

        const unmuteButton = cardElement.querySelector('.unmute-btn');
        if (unmuteButton) {
            unmuteButton.addEventListener('click', () => this.bubbleConference.unmute());
        }

        const addVideo = cardElement.querySelector('.add-video-btn');
        if (addVideo) {
            addVideo.addEventListener('click', () => this.bubbleConference.addMedia(BubbleConferenceMedia.VIDEO));
        }

        const removeVideo = cardElement.querySelector('.remove-video-btn');
        if (removeVideo) {
            removeVideo.addEventListener('click', () => this.bubbleConference.removeMedia(BubbleConferenceMedia.VIDEO));
        }

        this.manageCellButtons(participant);
    }

    private manageCellButtons(participant: BubbleConferenceParticipant) {
        const cardElement = document.getElementById(participant.id);
        if (!cardElement) return;
        //add mute/unmute actions, but only show the buttons if the call capability is TRUE for this action
        const muteButton = cardElement.querySelector('.mute-btn');
        if (muteButton) {
            muteButton.classList.toggle("hidden", participant.mute);
        }

        const unmuteButton = cardElement.querySelector('.unmute-btn');
        if (unmuteButton) {
            unmuteButton.classList.toggle("hidden", !participant.mute);
        }

        const addVideo = cardElement.querySelector('.add-video-btn');
        if (addVideo) {
            addVideo.classList.toggle("hidden", Boolean(this.bubbleConference.localParticipant.videoSession));
        }

        const removeVideo = cardElement.querySelector('.remove-video-btn');
        if (removeVideo) {
            removeVideo.classList.toggle("hidden", Boolean(!this.bubbleConference.localParticipant.videoSession));
        }
    }

    private buildParticipantsCells() {

        this.buildCell(this.bubbleConference.localParticipant);
        this.bubbleConference.participants.forEach((participant) => { this.buildCell(participant); });

        //remove cells that are no longer here
        const callCardsContainer: any = document.getElementById('call-cards-container');
        const items = callCardsContainer.querySelectorAll("div");

        items.forEach(item => {
            const id = item.getAttribute('id');
            if (id !== this.bubbleConference.localParticipant.id && !this.bubbleConference.participants.find((participant) => participant.id === id)) {
                item.remove();
            }
        });
    }

    private subscribeForConferenceUpdates() {

        //build a simple UI
        this.buildParticipantsCells();

        this.bubbleConferenceSubscription = this.bubbleConference.subscribe((event: RBEvent) => {
            try {
                console.log(event.name);
                switch (event.name) {
                    case BubbleConferenceEvents.ON_STATUS_CHANGE:
                        // This event is fired when the bubbleConference connection status is changed.
                        // You can retreive the conference status in event data
                        if (this.bubbleConference.status === "ended" || this.bubbleConference.status === "unjoined") {
                            //we've left the conference, remove all listeners to avoid memory leak !
                            this.bubbleConferenceSubscription.unsubscribe();
                            this.bubbleConference = undefined;
                            //remove everything
                            document.getElementById('call-cards-container').innerHTML = '';
                        }
                        else if (this.bubbleConference.status === "connected") {
                            this.manageCellButtons(this.bubbleConference.localParticipant);
                        }
                        break;

                    case BubbleConferenceEvents.ON_PARTICIPANT_MUTE_CHANGE:
                        // This event is triggered when the mute status of a conference participant 
                        // (including the connectedUser) changes. 
                        const participant: BubbleConferenceParticipant = event.data.participant;

                        //in my case, I'll manage only my buttons
                        if (participant.id === this.connectedUser.dbId) { this.manageCellButtons(participant); }
                        break;

                    case BubbleConferenceEvents.ON_PARTICIPANT_LIST_CHANGE:
                        // This event is fiired when the conference participant list is updated
                        this.buildParticipantsCells();
                        break;

                    case BubbleConferenceEvents.ON_LOCAL_PARTICIPANT_MEDIA_CHANGE:
                        // This event is fired when a local participant media is modified
                        // When you receive this event, you can, for example, attach the 
                        // received media to a component of your UI, using the method ```attachMediaToHtmlElement```
                        const localParticipant: BubbleConferenceParticipant = this.bubbleConference.localParticipant;
                        if (event.data.action === BubbleConferenceMediaAction.ADDED && event.data.mediaType === BubbleConferenceMedia.VIDEO) {
                            this.bubbleConference.attachMediaToHtmlElement(`video_${localParticipant.id}`, event.data.mediaType, localParticipant);
                            document.getElementById(`video_${localParticipant.id}`).classList.toggle("hidden", false);

                        }
                        else if (event.data.action = BubbleConferenceMediaAction.REMOVED && event.data.mediaType === BubbleConferenceMedia.VIDEO) {
                            document.getElementById(`video_${localParticipant.id}`).classList.toggle("hidden", true);
                        }

                        //update the buttons
                        this.manageCellButtons(localParticipant);

                        break;

                    case BubbleConferenceEvents.ON_REMOTE_MEDIA_CHANGE:
                        // This event is fired when a remote participant media is modified
                        // When you receive this event, you can, for example, attach the 
                        // received media to a component of your UI, using the method ```attachMediaToHtmlElement```
                        const remoteParticipant: BubbleConferenceParticipant = event.data.participant;
                        if (event.data.action === BubbleConferenceMediaAction.ADDED && event.data.mediaType === BubbleConferenceMedia.VIDEO) {
                            this.bubbleConference.attachMediaToHtmlElement(`video_${remoteParticipant.id}`, event.data.mediaType, remoteParticipant);
                            document.getElementById(`video_${remoteParticipant.id}`).classList.toggle("hidden", false);
                        }
                        else if (event.data.action = BubbleConferenceMediaAction.REMOVED && event.data.mediaType === BubbleConferenceMedia.VIDEO) {
                            document.getElementById(`video_${remoteParticipant.id}`).classList.toggle("hidden", true);
                        }

                        break;
                    default: break;
                }
            }
            catch (error) {
                //manage error here
            }

        });
    }


}

const testApplication = new TestApplication();
testApplication.init();