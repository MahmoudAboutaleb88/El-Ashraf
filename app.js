// ==============================================
// FIREBASE CONFIGURATION
// ==============================================
const firebaseConfig = {
    apiKey: "AIzaSyAATHo2-310ZNkYpaT_zMFEcYVfmzkZUR4",
    databaseURL: "https://davinci-434f1-default-rtdb.firebaseio.com",
    projectId: "davinci-434f1",
    storageBucket: "davinci-434f1.firebasestorage.app"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ==============================================
// GLOBAL VARIABLES
// ==============================================
let currentUser = null;
let notificationSystem = null;
let currentPostToEdit = null;
let currentPostToDelete = null;

// ==============================================
// UTILITY FUNCTIONS
// ==============================================
function checkAuth() {
    currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        window.location.href = 'index.html';
        throw new Error('يجب تسجيل الدخول أولاً');
    }
    return currentUser;
}

function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        </div>
        <div class="toast-content">
            <h4>${type === 'success' ? 'نجاح' : type === 'error' ? 'خطأ' : 'ملاحظة'}</h4>
            <p>${message}</p>
        </div>
    `;
    
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getTimeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'الآن';
    if (seconds < 3600) return `قبل ${Math.floor(seconds / 60)} دقيقة`;
    if (seconds < 86400) return `قبل ${Math.floor(seconds / 3600)} ساعة`;
    if (seconds < 2592000) return `قبل ${Math.floor(seconds / 86400)} يوم`;
    return `قبل ${Math.floor(seconds / 2592000)} شهر`;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function autoExpandTextarea(textarea, maxHeight = 200) {
    textarea.style.height = 'auto';
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = newHeight + 'px';
}

function getFirstLetter(name) {
    return name ? name.charAt(0) : 'م';
}

function closeAllMenus() {
    document.querySelectorAll('.post-menu-dropdown').forEach(menu => {
        menu.classList.remove('show');
    });
}

// ==============================================
// NOTIFICATION SYSTEM
// ==============================================
class NotificationSystem {
    constructor() {
        this.currentUser = checkAuth();
        this.unreadCount = 0;
        this.init();
    }
    
    async init() {
        if ("Notification" in window && Notification.permission === "default") {
            Notification.requestPermission();
        }
        
        await this.loadNotifications();
        this.setupRealtimeListener();
        setInterval(() => this.updateUnreadCount(), 30000);
    }
    
    async loadNotifications() {
        const notificationsRef = database.ref(`notifications/${this.currentUser.phone}`);
        notificationsRef.orderByChild('timestamp').limitToLast(20).once('value', (snapshot) => {
            const notifications = [];
            let unread = 0;
            
            snapshot.forEach((child) => {
                const notif = child.val();
                notif.id = child.key;
                notifications.unshift(notif);
                if (!notif.seen) unread++;
            });
            
            this.unreadCount = unread;
            this.updateUI(notifications);
        });
    }
    
    setupRealtimeListener() {
        const notificationsRef = database.ref(`notifications/${this.currentUser.phone}`);
        notificationsRef.orderByChild('timestamp').limitToLast(1).on('child_added', (snapshot) => {
            const newNotif = snapshot.val();
            newNotif.id = snapshot.key;
            
            this.unreadCount++;
            this.updateCounter();
            this.showDesktopNotification(newNotif);
            this.playNotificationSound();
            showToast(newNotif.message || 'إشعار جديد', 'info');
        });
    }
    
    showDesktopNotification(notification) {
        if (!("Notification" in window) || Notification.permission !== "granted") return;
        
        const notif = new Notification(notification.title || "قبيلة الأشراف", {
            body: notification.message || "منشور جديد",
            icon: "https://cdn-icons-png.flaticon.com/512/1077/1077114.png",
            tag: "ashraf-notification"
        });
        
        notif.onclick = () => {
            window.focus();
            if (notification.postId) {
                const postElement = document.querySelector(`.post-card[data-id="${notification.postId}"]`);
                if (postElement) postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        };
        
        setTimeout(() => notif.close(), 5000);
    }
    
    playNotificationSound() {
        try {
            const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-correct-answer-tone-2870.mp3');
            audio.volume = 0.3;
            audio.play();
        } catch (e) {}
    }
    
    updateUI(notifications) {
        const counter = document.getElementById('notificationCount');
        if (counter) {
            counter.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            counter.style.display = this.unreadCount > 0 ? 'flex' : 'none';
        }
    }
    
    updateCounter() {
        const counter = document.getElementById('notificationCount');
        if (counter) {
            counter.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
            counter.style.display = this.unreadCount > 0 ? 'flex' : 'none';
            if (this.unreadCount > 0) {
                counter.classList.add('pulse');
                setTimeout(() => counter.classList.remove('pulse'), 300);
            }
        }
    }
    
    async markAllAsRead() {
        try {
            const notificationsRef = database.ref(`notifications/${this.currentUser.phone}`);
            const snapshot = await notificationsRef.once('value');
            
            const updates = {};
            snapshot.forEach((child) => {
                if (!child.val().seen) {
                    updates[`${child.key}/seen`] = true;
                    updates[`${child.key}/seenAt`] = Date.now();
                }
            });
            
            await notificationsRef.update(updates);
            this.unreadCount = 0;
            this.updateCounter();
            showToast('تم تحديد جميع الإشعارات كمقروءة', 'success');
        } catch (error) {
            console.error('❌ خطأ في تحديد الإشعارات:', error);
        }
    }
    
    async updateUnreadCount() {
        try {
            const notificationsRef = database.ref(`notifications/${this.currentUser.phone}`);
            const snapshot = await notificationsRef.orderByChild('seen').equalTo(false).once('value');
            this.unreadCount = snapshot.numChildren();
            this.updateCounter();
        } catch (error) {
            console.error('❌ خطأ في تحديث العداد:', error);
        }
    }
    
    showModal() {
        const modal = document.getElementById('notificationsModal');
        const modalList = document.getElementById('modalNotificationsList');
        
        const notificationsRef = database.ref(`notifications/${this.currentUser.phone}`);
        notificationsRef.orderByChild('timestamp').limitToLast(20).once('value', (snapshot) => {
            const notifications = [];
            snapshot.forEach((childSnapshot) => {
                const notification = childSnapshot.val();
                notification.id = childSnapshot.key;
                notifications.unshift(notification);
            });
            
            if (notifications.length === 0) {
                modalList.innerHTML = `
                    <div style="padding: 40px 20px; text-align: center; color: #666;">
                        <i class="far fa-bell-slash" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                        <p>لا توجد إشعارات</p>
                    </div>
                `;
            } else {
                modalList.innerHTML = notifications.map(notif => `
                    <div style="padding: 15px; border-bottom: 1px solid #eee; ${!notif.seen ? 'background: #f0f8ff;' : ''}">
                        <div style="font-weight: 600; font-size: 14px; margin-bottom: 5px;">${notif.title || 'إشعار جديد'}</div>
                        <div style="font-size: 13px; color: #666; margin-bottom: 3px;">${notif.message || ''}</div>
                        <div style="font-size: 11px; color: #999;">${getTimeAgo(notif.timestamp)}</div>
                    </div>
                `).join('');
            }
        });
        
        modal.classList.add('show');
        
        // Mark all as read
        const updates = {};
        notificationsRef.once('value').then(snapshot => {
            snapshot.forEach(child => {
                if (!child.val().seen) {
                    updates[`${child.key}/seen`] = true;
                }
            });
            notificationsRef.update(updates);
        });
    }
}

// ==============================================
// POSTS SYSTEM
// ==============================================
function loadPosts() {
    const postsRef = database.ref('posts');
    const postsContainer = document.getElementById('postsContainer');
    
    postsRef.orderByChild('timestamp').on('value', (snapshot) => {
        postsContainer.innerHTML = '';
        const posts = [];
        
        snapshot.forEach((childSnapshot) => {
            const post = childSnapshot.val();
            post.id = childSnapshot.key;
            posts.unshift(post);
        });
        
        if (posts.length === 0) {
            postsContainer.innerHTML = `
                <div class="no-posts">
                    <i class="fas fa-comments"></i>
                    <h3>لا توجد منشورات بعد</h3>
                    <p>كن أول من ينشر في القبيلة!</p>
                </div>
            `;
        } else {
            posts.forEach(renderPost);
        }
    });
}

function renderPost(post) {
    const postsContainer = document.getElementById('postsContainer');
    const postElement = document.createElement('div');
    postElement.className = 'post-card';
    postElement.dataset.id = post.id;
    
    const firstLetter = getFirstLetter(post.authorName);
    const timeAgo = getTimeAgo(post.timestamp);
    
    let postContent = '';
    
    if (post.type === 'vote') {
        postContent = `
            <div class="post-header">
                <div class="author-avatar">${firstLetter}</div>
                <div class="author-info">
                    <h4>${post.authorName || 'عضو القبيلة'}</h4>
                    <div class="post-time">
                        <span class="post-type-badge">تصويت</span>
                        <span>${timeAgo}</span>
                        ${post.editedAt ? '<span style="color:#666; font-size:11px; margin-right:5px;">(تم التعديل)</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="post-content">
                <div class="post-text">${escapeHtml(post.text)}</div>
                <div class="vote-post" id="vote-${post.id}">
                    ${renderVoteOptions(post)}
                </div>
            </div>
        `;
    } else {
        postContent = `
            <div class="post-header">
                <div class="author-avatar">${firstLetter}</div>
                <div class="author-info">
                    <h4>${post.authorName || 'عضو القبيلة'}</h4>
                    <div class="post-time">
                        <span class="post-type-badge">منشور</span>
                        <span>${timeAgo}</span>
                        ${post.editedAt ? '<span style="color:#666; font-size:11px; margin-right:5px;">(تم التعديل)</span>' : ''}
                    </div>
                </div>
            </div>
            <div class="post-content">
                <div class="post-text">${escapeHtml(post.text)}</div>
            </div>
        `;
    }
    
    postElement.innerHTML = postContent + `
        <div class="post-stats">
            <div class="likes-count">
                <i class="fas fa-thumbs-up"></i>
                <span>${post.likes || 0} إعجاب</span>
            </div>
            <div class="dislikes-count">
                <i class="fas fa-thumbs-down"></i>
                <span>${post.dislikes || 0} عدم إعجاب</span>
            </div>
            <div class="comments-count">
                <span>${post.comments ? Object.keys(post.comments).length : 0} تعليق</span>
            </div>
        </div>
        <div class="post-actions-bar">
            <button class="post-action-btn like-btn" data-id="${post.id}">
                <i class="far fa-thumbs-up"></i>
                <span>إعجاب</span>
            </button>
            <button class="post-action-btn dislike-btn" data-id="${post.id}">
                <i class="far fa-thumbs-down"></i>
                <span>عدم إعجاب</span>
            </button>
            <button class="post-action-btn comment-btn" data-id="${post.id}">
                <i class="far fa-comment"></i>
                <span>تعليق</span>
            </button>
        </div>
        <div class="comments-section" id="comments-${post.id}"></div>
    `;
    
    postsContainer.appendChild(postElement);
    
    // Add menu button for post actions
    const postHeader = postElement.querySelector('.post-header');
    const menuContainer = document.createElement('div');
    menuContainer.style.position = 'relative';
    
    const menuButton = document.createElement('button');
    menuButton.className = 'post-menu-btn';
    menuButton.innerHTML = '<i class="fas fa-ellipsis-h"></i>';
    menuButton.dataset.postId = post.id;
    
    const menuDropdown = document.createElement('div');
    menuDropdown.className = 'post-menu-dropdown';
    menuDropdown.id = `menu-${post.id}`;
    
    // Show edit/delete only for post author
    if (post.authorId === currentUser.phone) {
        menuDropdown.innerHTML = `
            <button class="post-menu-item edit-post-btn" data-post-id="${post.id}">
                <i class="fas fa-edit"></i>
                <span>تعديل</span>
            </button>
            <button class="post-menu-item delete delete-post-btn" data-post-id="${post.id}">
                <i class="fas fa-trash-alt"></i>
                <span>حذف</span>
            </button>
        `;
    } else {
        menuDropdown.innerHTML = `
            <button class="post-menu-item" onclick="reportPost('${post.id}')">
                <i class="fas fa-flag"></i>
                <span>الإبلاغ</span>
            </button>
        `;
    }
    
    menuContainer.appendChild(menuButton);
    menuContainer.appendChild(menuDropdown);
    postHeader.appendChild(menuContainer);
    
    // Add event listeners for menu
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllMenus();
        menuDropdown.classList.toggle('show');
    });
    
    // Load comments
    loadComments(post.id);
    addCommentInput(post.id);
    
    // Add event listeners
    const likeBtn = postElement.querySelector('.like-btn');
    const dislikeBtn = postElement.querySelector('.dislike-btn');
    const commentBtn = postElement.querySelector('.comment-btn');
    
    likeBtn.addEventListener('click', () => toggleLike(post.id));
    dislikeBtn.addEventListener('click', () => toggleDislike(post.id));
    commentBtn.addEventListener('click', () => focusComment(post.id));
    
    if (post.type === 'vote') {
        setupVoteOptions(post.id, post.options || []);
    }
    
    updateLikeDislikeState(post.id, post);
}

function renderVoteOptions(post) {
    const options = post.options || [];
    const votes = post.votes || {};
    const totalVotes = Object.keys(votes).length;
    const userVote = votes[currentUser.phone];
    
    let optionsHtml = '<h5>اختر إجابة:</h5>';
    options.forEach((option, index) => {
        const optionVotes = Object.values(votes).filter(v => v === index).length;
        const percentage = totalVotes > 0 ? Math.round((optionVotes / totalVotes) * 100) : 0;
        const isSelected = userVote === index;
        
        optionsHtml += `
            <div class="vote-option-result ${isSelected ? 'selected' : ''}" data-index="${index}">
                <div class="vote-bar" style="width: ${percentage}%"></div>
                <div class="vote-content">
                    <div class="vote-text">${escapeHtml(option)}</div>
                    <div class="vote-percentage">${percentage}%</div>
                </div>
                <div class="vote-count">${optionVotes} صوت</div>
            </div>
        `;
    });
    return optionsHtml;
}

function setupVoteOptions(postId, options) {
    const voteOptions = document.querySelectorAll(`#vote-${postId} .vote-option-result`);
    voteOptions.forEach(option => {
        option.addEventListener('click', async () => {
            const optionIndex = parseInt(option.dataset.index);
            await castVote(postId, optionIndex);
        });
    });
}

async function castVote(postId, optionIndex) {
    try {
        await database.ref(`posts/${postId}/votes/${currentUser.phone}`).set(optionIndex);
        showToast('تم تسجيل صوتك بنجاح', 'success');
    } catch (error) {
        console.error('Error casting vote:', error);
        showToast('حدث خطأ في التصويت', 'error');
    }
}

function updateLikeDislikeState(postId, post) {
    const likes = post.likesData || {};
    const dislikes = post.dislikesData || {};
    const likeBtn = document.querySelector(`.like-btn[data-id="${postId}"]`);
    const dislikeBtn = document.querySelector(`.dislike-btn[data-id="${postId}"]`);
    
    if (likes[currentUser.phone]) {
        likeBtn.classList.add('liked');
        likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i><span>إعجاب</span>';
    }
    if (dislikes[currentUser.phone]) {
        dislikeBtn.classList.add('disliked');
        dislikeBtn.innerHTML = '<i class="fas fa-thumbs-down"></i><span>عدم إعجاب</span>';
    }
}

async function toggleLike(postId) {
    try {
        const postRef = database.ref(`posts/${postId}`);
        await postRef.transaction((post) => {
            if (!post) return post;
            if (!post.likesData) post.likesData = {};
            if (!post.dislikesData) post.dislikesData = {};
            
            const userPhone = currentUser.phone;
            if (post.likesData[userPhone]) {
                delete post.likesData[userPhone];
                post.likes = Math.max(0, (post.likes || 1) - 1);
            } else {
                post.likesData[userPhone] = true;
                if (post.dislikesData[userPhone]) {
                    delete post.dislikesData[userPhone];
                    post.dislikes = Math.max(0, (post.dislikes || 1) - 1);
                }
                post.likes = (post.likes || 0) + 1;
            }
            return post;
        });
    } catch (error) {
        console.error('Error toggling like:', error);
        showToast('حدث خطأ في الإعجاب', 'error');
    }
}

async function toggleDislike(postId) {
    try {
        const postRef = database.ref(`posts/${postId}`);
        await postRef.transaction((post) => {
            if (!post) return post;
            if (!post.likesData) post.likesData = {};
            if (!post.dislikesData) post.dislikesData = {};
            
            const userPhone = currentUser.phone;
            if (post.dislikesData[userPhone]) {
                delete post.dislikesData[userPhone];
                post.dislikes = Math.max(0, (post.dislikes || 1) - 1);
            } else {
                post.dislikesData[userPhone] = true;
                if (post.likesData[userPhone]) {
                    delete post.likesData[userPhone];
                    post.likes = Math.max(0, (post.likes || 1) - 1);
                }
                post.dislikes = (post.dislikes || 0) + 1;
            }
            return post;
        });
    } catch (error) {
        console.error('Error toggling dislike:', error);
        showToast('حدث خطأ في عدم الإعجاب', 'error');
    }
}

// ==============================================
// COMMENTS SYSTEM
// ==============================================
function loadComments(postId) {
    const commentsRef = database.ref(`posts/${postId}/comments`);
    commentsRef.orderByChild('timestamp').on('value', (snapshot) => {
        const commentsSection = document.getElementById(`comments-${postId}`);
        if (!commentsSection) return;
        
        const existingComments = commentsSection.querySelectorAll('.comment');
        existingComments.forEach(comment => comment.remove());
        
        snapshot.forEach((childSnapshot) => {
            const comment = childSnapshot.val();
            const timeAgo = getTimeAgo(comment.timestamp);
            
            const commentElement = document.createElement('div');
            commentElement.className = 'comment';
            commentElement.innerHTML = `
                <div class="comment-avatar">${getFirstLetter(comment.authorName)}</div>
                <div class="comment-content">
                    <div class="comment-author">${comment.authorName || 'عضو'}</div>
                    <div class="comment-text">${escapeHtml(comment.text)}</div>
                    <div class="comment-time">${timeAgo}</div>
                </div>
            `;
            
            const addCommentDiv = commentsSection.querySelector('.add-comment');
            if (addCommentDiv) {
                commentsSection.insertBefore(commentElement, addCommentDiv);
            } else {
                commentsSection.appendChild(commentElement);
            }
        });
    });
}

function addCommentInput(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    const commentInputHTML = `
        <div class="add-comment">
            <div class="comment-avatar">${getFirstLetter(currentUser.name)}</div>
            <div class="comment-input-container">
                <textarea class="comment-input" placeholder="اكتب تعليقاً..." rows="1" data-post="${postId}"></textarea>
                <button class="comment-btn" data-post="${postId}"><i class="fas fa-paper-plane"></i></button>
            </div>
        </div>
    `;
    commentsSection.innerHTML += commentInputHTML;
    
    const commentSubmitBtn = commentsSection.querySelector('.comment-btn');
    const commentInput = commentsSection.querySelector('.comment-input');
    
    commentSubmitBtn.addEventListener('click', () => addComment(postId));
    commentInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            addComment(postId);
        }
    });
    commentInput.addEventListener('input', () => autoExpandTextarea(commentInput, 120));
}

async function addComment(postId) {
    const commentInput = document.querySelector(`.comment-input[data-post="${postId}"]`);
    const commentText = commentInput.value.trim();
    
    if (!commentText) return;
    
    try {
        const comment = {
            text: commentText,
            authorId: currentUser.phone,
            authorName: currentUser.name,
            timestamp: Date.now()
        };
        
        await database.ref(`posts/${postId}/comments`).push().set(comment);
        commentInput.value = '';
        autoExpandTextarea(commentInput, 120);
        showToast('تم نشر التعليق', 'success');
        
        const postRef = database.ref(`posts/${postId}`);
        const postSnapshot = await postRef.once('value');
        const post = postSnapshot.val();
        
        if (post.authorId !== currentUser.phone) {
            await database.ref(`notifications/${post.authorId}`).push().set({
                type: 'comment',
                title: 'تعليق جديد على منشورك',
                message: `${currentUser.name} علق على منشورك`,
                postId: postId,
                timestamp: Date.now(),
                seen: false
            });
        }
    } catch (error) {
        console.error('Error adding comment:', error);
        showToast('حدث خطأ في إضافة التعليق', 'error');
    }
}

function focusComment(postId) {
    const commentInput = document.querySelector(`.comment-input[data-post="${postId}"]`);
    if (commentInput) commentInput.focus();
}

// ==============================================
// POST MANAGEMENT FUNCTIONS
// ==============================================
function showEditModal(postId) {
    const postRef = database.ref(`posts/${postId}`);
    postRef.once('value').then((snapshot) => {
        const post = snapshot.val();
        if (!post) return;
        
        currentPostToEdit = postId;
        const editModal = document.getElementById('editModal');
        const editInput = document.getElementById('editPostInput');
        const editVoteOptions = document.getElementById('editVoteOptions');
        
        editInput.value = post.text;
        autoExpandTextarea(editInput, 300);
        
        // If it's a vote post
        if (post.type === 'vote') {
            editVoteOptions.style.display = 'block';
            editVoteOptions.innerHTML = '';
            
            post.options.forEach((option, index) => {
                const optionDiv = document.createElement('div');
                optionDiv.className = 'edit-vote-option';
                optionDiv.innerHTML = `
                    <input type="text" value="${escapeHtml(option)}" class="edit-vote-option-input" data-index="${index}">
                `;
                editVoteOptions.appendChild(optionDiv);
            });
        } else {
            editVoteOptions.style.display = 'none';
        }
        
        editModal.classList.add('show');
        editInput.focus();
    });
}

function showDeleteConfirmModal(postId) {
    currentPostToDelete = postId;
    document.getElementById('confirmDeleteModal').classList.add('show');
}

async function updatePost() {
    if (!currentPostToEdit) return;
    
    const editInput = document.getElementById('editPostInput');
    const newText = editInput.value.trim();
    
    if (!newText) {
        showToast('الرجاء كتابة نص المنشور', 'error');
        return;
    }
    
    try {
        const postRef = database.ref(`posts/${currentPostToEdit}`);
        const snapshot = await postRef.once('value');
        const post = snapshot.val();
        
        const updates = {
            text: newText,
            editedAt: Date.now(),
            editedBy: currentUser.phone
        };
        
        // If it's a vote post, update options
        if (post.type === 'vote') {
            const optionInputs = document.querySelectorAll('.edit-vote-option-input');
            const newOptions = Array.from(optionInputs)
                .map(input => input.value.trim())
                .filter(value => value);
            
            if (newOptions.length < 2) {
                showToast('يجب أن يحتوي التصويت على خيارين على الأقل', 'error');
                return;
            }
            
            updates.options = newOptions;
        }
        
        await postRef.update(updates);
        showToast('تم تحديث المنشور بنجاح', 'success');
        closeEditModal();
        
    } catch (error) {
        console.error('Error updating post:', error);
        showToast('حدث خطأ في تحديث المنشور', 'error');
    }
}

async function deletePost() {
    if (!currentPostToDelete) return;
    
    try {
        // Delete the post
        await database.ref(`posts/${currentPostToDelete}`).remove();
        
        // Delete associated comments (optional)
        await database.ref(`posts/${currentPostToDelete}/comments`).remove();
        
        // Delete notifications related to the post
        const notificationsRef = database.ref('notifications');
        const snapshot = await notificationsRef.once('value');
        
        const updates = {};
        snapshot.forEach((userSnapshot) => {
            userSnapshot.forEach((notificationSnapshot) => {
                const notification = notificationSnapshot.val();
                if (notification.postId === currentPostToDelete) {
                    updates[`notifications/${userSnapshot.key}/${notificationSnapshot.key}`] = null;
                }
            });
        });
        
        await database.ref().update(updates);
        
        showToast('تم حذف المنشور بنجاح', 'success');
        closeDeleteModal();
        
    } catch (error) {
        console.error('Error deleting post:', error);
        showToast('حدث خطأ في حذف المنشور', 'error');
    }
}

function closeEditModal() {
    document.getElementById('editModal').classList.remove('show');
    currentPostToEdit = null;
    document.getElementById('editPostInput').value = '';
    document.getElementById('editVoteOptions').innerHTML = '';
}

function closeDeleteModal() {
    document.getElementById('confirmDeleteModal').classList.remove('show');
    currentPostToDelete = null;
}

function reportPost(postId) {
    const reportData = {
        postId: postId,
        reporterId: currentUser.phone,
        reporterName: currentUser.name,
        reason: 'إبلاغ من المستخدم',
        timestamp: Date.now()
    };
    
    database.ref(`reports/${postId}`).push().set(reportData)
        .then(() => {
            showToast('تم الإبلاغ عن المنشور للمسؤولين', 'success');
        })
        .catch((error) => {
            console.error('Error reporting post:', error);
            showToast('حدث خطأ في الإبلاغ', 'error');
        });
}

// ==============================================
// PUBLISH POST
// ==============================================
async function publishPost() {
    const postInput = document.getElementById('postInput');
    const postText = postInput.value.trim();
    const activeType = document.querySelector('.post-type-btn.active').dataset.type;
    
    if (!postText) {
        showToast('الرجاء كتابة محتوى المنشور', 'error');
        return;
    }
    
    if (activeType === 'vote') {
        const voteOptions = Array.from(document.querySelectorAll('.vote-option-input'))
            .map(input => input.value.trim())
            .filter(value => value);
        
        if (voteOptions.length < 2) {
            showToast('يجب إضافة خيارين على الأقل للتصويت', 'error');
            return;
        }
    }
    
    const submitPost = document.getElementById('submitPost');
    submitPost.disabled = true;
    const originalHTML = submitPost.innerHTML;
    submitPost.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const postRef = database.ref('posts').push();
        const postId = postRef.key;
        
        const postData = {
            id: postId,
            text: postText,
            type: activeType,
            authorId: currentUser.phone,
            authorName: currentUser.name,
            timestamp: Date.now(),
            likes: 0,
            dislikes: 0,
            likesData: {},
            dislikesData: {},
            comments: {}
        };
        
        if (activeType === 'vote') {
            const voteOptions = Array.from(document.querySelectorAll('.vote-option-input'))
                .map(input => input.value.trim())
                .filter(value => value);
            postData.options = voteOptions;
            postData.votes = {};
        }
        
        await postRef.set(postData);
        
        // Send notifications to all users
        await sendNotificationToAllUsers({
            type: 'new_post',
            title: 'منشور جديد في القبيلة!',
            message: `${currentUser.name} نشر ${activeType === 'vote' ? 'تصويت جديد' : 'منشور جديد'}`,
            postId: postId,
            authorName: currentUser.name,
            timestamp: Date.now()
        });
        
        postInput.value = '';
        autoExpandTextarea(postInput);
        
        if (activeType === 'vote') {
            document.querySelectorAll('.vote-option-input').forEach((input, index) => {
                if (index < 2) {
                    input.value = index === 0 ? 'الخيار الأول' : 'الخيار الثاني';
                } else {
                    input.parentElement.remove();
                }
            });
        }
        
        showToast('تم نشر المنشور بنجاح', 'success');
    } catch (error) {
        console.error('Error publishing post:', error);
        showToast('حدث خطأ في نشر المنشور', 'error');
    } finally {
        submitPost.innerHTML = originalHTML;
        submitPost.disabled = false;
    }
}

async function sendNotificationToAllUsers(notificationData) {
    try {
        const usersRef = database.ref('users');
        const usersSnapshot = await usersRef.once('value');
        const notificationsPromises = [];
        
        usersSnapshot.forEach((userSnapshot) => {
            const userId = userSnapshot.key;
            if (userId === currentUser.phone) return;
            
            const userNotificationRef = database.ref(`notifications/${userId}`).push();
            const notificationId = userNotificationRef.key;
            
            const fullNotification = {
                ...notificationData,
                id: notificationId,
                userId: userId,
                seen: false,
                timestamp: Date.now()
            };
            
            notificationsPromises.push(userNotificationRef.set(fullNotification));
        });
        
        await Promise.all(notificationsPromises);
    } catch (error) {
        console.error('Error sending notifications:', error);
    }
}

// ==============================================
// INITIALIZATION
// ==============================================
function initApp() {
    try {
        checkAuth();
        setUserInfo();
        loadPosts();
        notificationSystem = new NotificationSystem();
        setupEventListeners();
        console.log('📱 التطبيق جاهز للعمل!');
    } catch (error) {
        console.error('❌ خطأ في تحميل التطبيق:', error);
    }
}

function setUserInfo() {
    const firstLetter = getFirstLetter(currentUser.name);
    document.getElementById('userAvatar').textContent = firstLetter;
    document.getElementById('postAvatar').textContent = firstLetter;
}

function setupEventListeners() {
    const postInput = document.getElementById('postInput');
    const submitPost = document.getElementById('submitPost');
    const postTypeButtons = document.querySelectorAll('.post-type-btn');
    const addOptionBtn = document.getElementById('addOptionBtn');
    const notificationBell = document.getElementById('notificationBell');
    const logoutBtnNav = document.getElementById('logoutBtnNav');
    const closeNotificationsModal = document.getElementById('closeNotificationsModal');
    
    // Auto-expand textarea
    postInput.addEventListener('input', () => autoExpandTextarea(postInput));
    
    // Submit post with Enter key
    postInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            publishPost();
        }
    });
    
    // Submit post button
    submitPost.addEventListener('click', publishPost);
    
    // Post type selector
    postTypeButtons.forEach(button => {
        button.addEventListener('click', () => {
            postTypeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const voteOptionsContainer = document.getElementById('voteOptionsContainer');
            if (button.dataset.type === 'vote') {
                voteOptionsContainer.classList.add('show');
            } else {
                voteOptionsContainer.classList.remove('show');
            }
        });
    });
    
    // Add vote option
    addOptionBtn.addEventListener('click', () => {
        const voteOption = document.createElement('div');
        voteOption.className = 'vote-option';
        voteOption.innerHTML = `<input type="text" placeholder="خيار جديد" class="vote-option-input">`;
        document.getElementById('voteOptionsContainer').insertBefore(voteOption, addOptionBtn);
    });
    
    // Notification bell
    notificationBell.addEventListener('click', () => {
        notificationSystem.showModal();
    });
    
    // Logout
    logoutBtnNav.addEventListener('click', () => {
        if (confirm('هل تريد تسجيل الخروج؟')) {
            localStorage.removeItem('currentUser');
            window.location.href = 'index.html';
        }
    });
    
    // Close notifications modal
    if (closeNotificationsModal) {
        closeNotificationsModal.addEventListener('click', () => {
            document.getElementById('notificationsModal').classList.remove('show');
        });
    }
    
    // Bottom navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function() {
            if (this.id === 'logoutBtnNav') return;
            document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            this.classList.add('active');
        });
    });
    
    // Edit Post Modal
    document.getElementById('closeEditModal')?.addEventListener('click', closeEditModal);
    document.getElementById('cancelEditBtn')?.addEventListener('click', closeEditModal);
    document.getElementById('saveEditBtn')?.addEventListener('click', updatePost);
    
    // Delete Post Modal
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', deletePost);
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', closeDeleteModal);
    
    // Close modals when clicking outside
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('edit-modal-overlay')) {
            closeEditModal();
        }
        if (e.target.classList.contains('confirm-modal-overlay')) {
            closeDeleteModal();
        }
    });
    
    // Event delegation for post menu items
    document.addEventListener('click', (e) => {
        // Edit post button
        if (e.target.closest('.edit-post-btn')) {
            const postId = e.target.closest('.edit-post-btn').dataset.postId;
            showEditModal(postId);
            closeAllMenus();
        }
        
        // Delete post button
        if (e.target.closest('.delete-post-btn')) {
            const postId = e.target.closest('.delete-post-btn').dataset.postId;
            showDeleteConfirmModal(postId);
            closeAllMenus();
        }
    });
    
    // Enter + Ctrl to save edit
    document.getElementById('editPostInput')?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            e.preventDefault();
            updatePost();
        }
    });
    
    // Close menus when clicking outside
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.post-menu-btn') && !e.target.closest('.post-menu-dropdown')) {
            closeAllMenus();
        }
    });
}

// ==============================================
// CSS FIXES - Add to the end of app.js
// ==============================================
function updateLikeDislikeState(postId, post) {
    const likes = post.likesData || {};
    const dislikes = post.dislikesData || {};
    const likeBtn = document.querySelector(`.like-btn[data-id="${postId}"]`);
    const dislikeBtn = document.querySelector(`.dislike-btn[data-id="${postId}"]`);
    
    if (!likeBtn || !dislikeBtn) return;
    
    // Reset classes
    likeBtn.classList.remove('liked');
    dislikeBtn.classList.remove('disliked');
    
    // Update based on user interaction
    if (likes[currentUser.phone]) {
        likeBtn.classList.add('liked');
        likeBtn.innerHTML = '<i class="fas fa-thumbs-up"></i><span>إعجاب</span>';
    } else {
        likeBtn.innerHTML = '<i class="far fa-thumbs-up"></i><span>إعجاب</span>';
    }
    
    if (dislikes[currentUser.phone]) {
        dislikeBtn.classList.add('disliked');
        dislikeBtn.innerHTML = '<i class="fas fa-thumbs-down"></i><span>عدم إعجاب</span>';
    } else {
        dislikeBtn.innerHTML = '<i class="far fa-thumbs-down"></i><span>عدم إعجاب</span>';
    }
}

// Update the renderPost function to use the correct avatar
function getFirstLetter(name) {
    if (!name || typeof name !== 'string') return 'م';
    return name.charAt(0).toUpperCase();
}

// Add proper event delegation for post menus
document.addEventListener('click', function(e) {
    // Handle menu buttons
    if (e.target.closest('.post-menu-btn')) {
        const menuBtn = e.target.closest('.post-menu-btn');
        const postCard = menuBtn.closest('.post-card');
        const menuDropdown = postCard.querySelector('.post-menu-dropdown');
        
        // Close all other menus
        document.querySelectorAll('.post-menu-dropdown.show').forEach(dropdown => {
            if (dropdown !== menuDropdown) dropdown.classList.remove('show');
        });
        
        // Toggle current menu
        menuDropdown.classList.toggle('show');
        e.stopPropagation();
    }
    
    // Close menus when clicking outside
    if (!e.target.closest('.post-menu-dropdown') && !e.target.closest('.post-menu-btn')) {
        document.querySelectorAll('.post-menu-dropdown.show').forEach(dropdown => {
            dropdown.classList.remove('show');
        });
    }
    
    // Handle menu items
    if (e.target.closest('.post-menu-item')) {
        const menuItem = e.target.closest('.post-menu-item');
        const postCard = menuItem.closest('.post-card');
        const postId = postCard.dataset.id;
        
        if (menuItem.classList.contains('edit-post-btn')) {
            showEditModal(postId);
        } else if (menuItem.classList.contains('delete-post-btn')) {
            showDeleteConfirmModal(postId);
        } else if (menuItem.textContent.includes('الإبلاغ')) {
            reportPost(postId);
        }
        
        // Close menu
        postCard.querySelector('.post-menu-dropdown').classList.remove('show');
    }
});
// ==============================================
// START APPLICATION
// ==============================================
document.addEventListener('DOMContentLoaded', initApp);

// Auto-logout after 24 hours
setTimeout(() => {
    localStorage.removeItem('currentUser');
    window.location.href = 'index.html';
}, 24 * 60 * 60 * 1000);