var template = `
<div id="page-home">
    <div class="page-header">
        <input type="text" placeholder="Search url, keyword or tags" v-model.trim="search" @focus="$event.target.select()" @keyup.enter="searchBookmarks"/>
        <a title="Refresh storage" @click="reloadData">
            <i class="fas fa-fw fa-sync-alt" :class="loading && 'fa-spin'"></i>
        </a>
        <a title="Add new bookmark">
            <i class="fas fa-fw fa-plus-circle"></i>
        </a>
        <a title="Batch edit">
            <i class="fas fa-fw fa-pencil-alt"></i>
        </a>
        <a title="Show tags">
            <i class="fas fa-fw fa-tags"></i>
        </a>
    </div>
    <div id="bookmarks-grid" ref="bookmarksGrid" :class="{list: displayOptions.listMode}">
        <bookmark-item v-for="book in bookmarks" 
                        v-bind="book" 
                        :key="book.id" 
                        :showId="displayOptions.showId"
                        :listMode="displayOptions.listMode"
                        @tagClicked="filterTag">
        </bookmark-item>
        <div class="pagination-box" v-if="maxPage > 0">
            <p>Page</p>
            <input type="text" 
                    placeholder="1" 
                    :value="page" 
                    @focus="$event.target.select()" 
                    @keyup.enter="changePage($event.target.value)" 
                    :disabled="editMode">
            <p>{{maxPage}}</p>
            <div class="spacer"></div>
            <template v-if="!editMode">
                <a v-if="page > 2" title="Go to first page" @click="changePage(1)">
                    <i class="fas fa-fw fa-angle-double-left"></i>
                </a>
                <a v-if="page > 1" title="Go to previous page" @click="changePage(page-1)">
                    <i class="fa fa-fw fa-angle-left"></i>
                </a>
                <a v-if="page < maxPage" title="Go to next page" @click="changePage(page+1)">
                    <i class="fa fa-fw fa-angle-right"></i>
                </a>
                <a v-if="page < maxPage - 1" title="Go to last page" @click="changePage(maxPage)">
                    <i class="fas fa-fw fa-angle-double-right"></i>
                </a>
            </template>
        </div>
    </div>
    <p class="empty-message" v-if="!loading && listIsEmpty">No saved bookmarks yet :(</p>
    <div class="loading-overlay" v-if="loading"><i class="fas fa-fw fa-spin fa-spinner"></i></div>
    <custom-dialog v-bind="dialog"/>
</div>`

import bookmarkItem from "../component/bookmark.js";
import customDialog from "../component/dialog.js";
import basePage from "./base.js";

export default {
    template: template,
    mixins: [basePage],
    components: {
        bookmarkItem,
        customDialog
    },
    data() {
        return {
            loading: false,
            editMode: false,
            search: "",
            page: 0,
            maxPage: 0,
            bookmarks: []
        }
    },
    computed: {
        listIsEmpty() {
            return this.bookmarks.length <= 0;
        }
    },
    methods: {
        reloadData() {
            if (this.loading) return;
            this.page = 1;
            this.search = "";
            this.loadBookmarks();
        },
        loadBookmarks(saveState) {
            if (this.loading) return;

            // By default, we eill save the state
            saveState = (typeof saveState === "boolean") ? saveState : true;

            // Parse search query
            var rxTagA = /['"]#([^'"]+)['"]/g, // "#tag with space"
                rxTagB = /(^|\s+)#(\S+)/g, // #tag-without-space
                keyword = this.search,
                tags = [],
                rxResult;

            // Fetch tag A first
            while (rxResult = rxTagA.exec(keyword)) {
                tags.push(rxResult[1]);
            }

            // Clear tag A from keyword
            keyword = keyword.replace(rxTagA, '');

            // Fetch tag B
            while (rxResult = rxTagB.exec(keyword)) {
                tags.push(rxResult[2]);
            }

            // Clear tag B from keyword, then trim keyword
            keyword = keyword.replace(rxTagB, '').trim().replace(/\s+/g, ' ');

            // Prepare URL for API
            var url = new URL("/api/bookmarks", document.URL);
            url.search = new URLSearchParams({
                keyword: keyword,
                tags: tags.join(","),
                page: this.page
            });

            // Fetch data from API
            this.loading = true;

            fetch(url)
                .then(response => {
                    if (!response.ok) throw response;
                    return response.json();
                })
                .then(json => {
                    // Set data
                    this.page = json.page;
                    this.maxPage = json.maxPage;
                    this.bookmarks = json.bookmarks;
                    this.loading = false;

                    // Save state and change URL if needed
                    if (saveState) {
                        var history = {
                            activePage: "page-home",
                            search: this.search,
                            page: this.page
                        };

                        var urlQueries = [];
                        if (this.page > 1) urlQueries.push(`page=${this.page}`);
                        if (this.search !== "") urlQueries.push(`search=${this.search}`);

                        var url = "#home"
                        if (urlQueries.length > 0) {
                            url += `?${urlQueries.join("&")}`;
                        }

                        window.history.pushState(history, "page-home", url);
                    }
                })
                .catch(err => {
                    this.loading = false;
                    err.text().then(msg => {
                        this.showErrorDialog(`${msg} (${err.status})`);
                    })
                });
        },
        searchBookmarks() {
            this.page = 1;
            this.loadBookmarks();
        },
        changePage(page) {
            page = parseInt(page, 10) || 0;
            if (page >= this.maxPage) this.page = this.maxPage;
            else if (page <= 1) this.page = 1;
            else this.page = page;

            this.$refs.bookmarksGrid.scrollTop = 0;
            this.loadBookmarks();
        },
        filterTag(tagName) {
            var rxSpace = /\s+/g,
                newTag = rxSpace.test(tagName) ? `"#${tagName}"` : `#${tagName}`;

            if (!this.search.includes(newTag)) {
                this.search += ` ${newTag}`;
                this.loadBookmarks();
            }
        }
    },
    mounted() {
        var stateWatcher = (e) => {
            var state = e.state || {},
                activePage = state.activePage || "page-home",
                search = state.search || "",
                page = state.page || 1;

            if (activePage !== "page-home") return;

            this.page = page;
            this.search = search;
            this.loadBookmarks(false);
        }

        window.addEventListener('popstate', stateWatcher);
        this.$once('hook:beforeDestroy', function() {
            window.removeEventListener('popstate', stateWatcher);
        })

        this.loadBookmarks(false);
    }
}