import type { NodeSystem } from '../NodeSystem';
import { CustomNode } from '../nodes/CustomNode';
import { uuid, positionNode } from '../utils';
import './customNodeLibrary.css';
import { ToastMessage } from '../toastMessage/ToastMessage';
export default class CustomNodeLibrary {
    htmlElement: HTMLDivElement;
    openPromise: Promise<void>;
    customNodes: HTMLLIElement[] = [];

    openPromiseResolve: () => void;
    openPromiseReject: () => void;

    constructor(private nodeSystem: NodeSystem) {
        this.create();
    }

    create() {
        this.htmlElement = document.createElement('div');
        this.htmlElement.className = 'custom-node-library-container';
        const content = document.createElement('div');
        content.className = 'custom-node-library';
        this.htmlElement.appendChild(content);
        const closeButton = document.createElement('div');
        closeButton.className = 'close-button';
        closeButton.innerText = 'x';
        closeButton.onclick = () => {
            this.close();
        }
        content.appendChild(closeButton);

        const title = document.createElement('h1');
        title.innerText = 'Custom Node Library';
        content.appendChild(title);

        const searchBar = document.createElement('input');
        searchBar.className = 'search-bar';
        searchBar.placeholder = 'Search';
        searchBar.oninput = () => {
            this.filter(searchBar.value);
        }
        content.appendChild(searchBar);


        const nodeLibrary = document.createElement('div');
        nodeLibrary.className = 'node-library';
        content.appendChild(nodeLibrary);

        const nodeLibraryList = document.createElement('ul');
        nodeLibrary.appendChild(nodeLibraryList);
        nodeLibraryList.className = 'node-library-list';

        const pinnedCustomNodes = this.nodeSystem.config.private.pinnedCustomNodes;
        
        const nodeLibraryListItems = this.nodeSystem.saveManager.getCustomNodes().map((node) => {
            const listItem = document.createElement('li');
            listItem.className = 'node-library-list-item';
            listItem.onclick = () => {
                try {
                    const newNode = new CustomNode(uuid(), 0, 0, this.nodeSystem.editorState.layer, this.nodeSystem, [
                        {
                            name: 'saveId',
                            value: node.id
                        },
                        {
                            name: 'nodeName',
                            value: node.filename
                        }
                    ]);
                    positionNode(
                        newNode,
                        window.innerWidth / 2 / this.nodeSystem.editorState.view.zoom - this.nodeSystem.editorState.view.x,
                        window.innerHeight / 2 / this.nodeSystem.editorState.view.zoom - this.nodeSystem.editorState.view.y,
                        this.nodeSystem.nodeStorage,
                        this.nodeSystem.config,
                        this.nodeSystem.editorState.layer
                    );
                    this.nodeSystem.nodeStorage.addNode(newNode);
                    this.nodeSystem.nodeRenderer.requestRender();
    
                    this.close();
                } catch (error) {
                    console.error(error);
                    new ToastMessage('Failed to load custom node', 'danger').show();
                }
            }

            const pinIcon = document.createElement('div');
            pinIcon.className = 'pin-icon';
            listItem.appendChild(pinIcon);

            if (pinnedCustomNodes.includes(node.id)) {
                pinIcon.classList.add('pinned');
            }

            pinIcon.onclick = (e) => {
                e.stopPropagation();
                if (pinnedCustomNodes.includes(node.id)) {
                    const index = pinnedCustomNodes.indexOf(node.id);
                    pinnedCustomNodes.splice(index, 1);
                    pinIcon.classList.remove('pinned');
                } else {
                    pinnedCustomNodes.push(node.id);
                    pinIcon.classList.add('pinned');
                }
                localStorage.setItem('pinnedCustomNodes', JSON.stringify(pinnedCustomNodes));

                // refresh toolbar
                this.nodeSystem.toolbar.refresh();
            }

            const nodeTitle = document.createElement('div');
            nodeTitle.className = 'node-title';
            nodeTitle.innerText = node.filename;
            listItem.appendChild(nodeTitle);


            return listItem;
        });

        nodeLibraryListItems.forEach((item) => {
            nodeLibraryList.appendChild(item);
        });
        this.customNodes = nodeLibraryListItems;
    }

    open() {
        this.openPromise = new Promise((resolve, reject) => {
            window.document.body.appendChild(this.htmlElement);
            this.openPromiseResolve = resolve;
            this.openPromiseReject = reject;
        });
        return this.openPromise;
    }

    close() {
        this.htmlElement.remove();
        this.openPromiseResolve();
    }

    filter(keyword: string) {
        this.customNodes.forEach((node) => {
            if (node.innerText.replaceAll('\u00a0', ' ').toLowerCase().includes(keyword.toLowerCase())) {
                node.style.display = 'block';
            } else {
                node.style.display = 'none';
            }
        });
    }
}