// Blog Loader - Tự động load bài đăng từ GitHub API
class BlogLoader {
    constructor() {
        this.repoOwner = 'khetcompany'; // Thay bằng username GitHub của bạn
        this.repoName = 'khet'; // Tên repository
        this.postsPath = 'post';
        this.maxPosts = 3;
        this.blogContainer = document.getElementById('blog-posts-container');
    }

    async loadPosts() {
        try {
            // Lấy danh sách file từ thư mục post
            const files = await this.getPostFiles();
            // Lấy ngày commit cuối cùng cho từng file
            const filesWithDate = await Promise.all(
                files.map(async file => {
                    const commitDate = await this.getFileLastCommitDate(file.path);
                    return { ...file, commitDate };
                })
            );
            // Sắp xếp file theo ngày commit mới nhất
            const sortedFiles = filesWithDate.sort((a, b) => new Date(b.commitDate) - new Date(a.commitDate));
            // Lấy 3 file mới nhất
            const latestFiles = sortedFiles.slice(0, this.maxPosts);
            // Load nội dung của từng file
            const posts = await Promise.all(
                latestFiles.map(file => this.loadPostContent(file, file.commitDate))
            );
            // Hiển thị bài đăng
            this.displayPosts(posts);
        } catch (error) {
            console.error('Error loading posts:', error);
            this.showFallbackPosts();
        }
    }

    async getPostFiles() {
        const apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/contents/${this.postsPath}`;
        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        const files = await response.json();
        return files.filter(file => file.type === 'file' && file.name.endsWith('.html'));
    }

    // Lấy ngày commit cuối cùng của file
    async getFileLastCommitDate(filePath) {
        const apiUrl = `https://api.github.com/repos/${this.repoOwner}/${this.repoName}/commits?path=${filePath}&per_page=1`;
        const response = await fetch(apiUrl);
        if (!response.ok) return null;
        const commits = await response.json();
        if (commits.length > 0) {
            return commits[0].commit.committer.date;
        }
        return null;
    }

    async loadPostContent(file, commitDate) {
        const response = await fetch(file.download_url);
        const content = await response.text();
        // Parse HTML content để lấy title, subtitle, excerpt, và thumbnail
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const title = doc.querySelector('h1')?.textContent || 'Không có tiêu đề';
        const subtitle = doc.querySelector('h2')?.textContent || '';
        const excerpt = doc.querySelector('p')?.textContent || '';
        const date = doc.querySelector('p:last-child')?.textContent || '';
        // Lấy thumbnail từ img tag đầu tiên hoặc og:image meta tag
        let thumbnail = '';
        const imgTags = doc.querySelectorAll('img');
        for (const img of imgTags) {
            if (img.src) {
                thumbnail = img.src;
                break;
            }
        }
        if (!thumbnail) {
            const ogImage = doc.querySelector('meta[property="og:image"]');
            if (ogImage && ogImage.content) {
                thumbnail = ogImage.content;
            }
        }
        // Nếu vẫn không có thumbnail, dùng ảnh mặc định
        if (!thumbnail) {
            thumbnail = 'post/img-post/img.png';
        }
        return {
            title,
            subtitle,
            excerpt,
            date,
            thumbnail,
            filename: file.name,
            created_at: commitDate || '',
            category: this.getCategoryFromFilename(file.name)
        };
    }

    getCategoryFromFilename(filename) {
        if (filename.includes('tin-tuc') || filename.includes('news')) {
            return { name: 'Tin tức', color: 'red' };
        } else if (filename.includes('he-sinh-thai') || filename.includes('ecosystem')) {
            return { name: 'Hệ sinh thái', color: 'blue' };
        } else if (filename.includes('doi-tac') || filename.includes('partner')) {
            return { name: 'Đối tác', color: 'green' };
        } else {
            return { name: 'Bài viết', color: 'gray' };
        }
    }

    displayPosts(posts) {
        if (!this.blogContainer) return;
        if (posts.length === 0) {
            this.blogContainer.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <i class="fas fa-newspaper text-4xl text-gray-400 mb-4"></i>
                    <p class="text-gray-600">Chưa có bài đăng nào</p>
                </div>
            `;
            return;
        }
        const postsHTML = posts.map((post, index) => `
            <div class="bg-white rounded-xl shadow-lg overflow-hidden transform hover:scale-105 transition-all duration-300 cursor-pointer blog-post-card" data-aos="fade-up" data-aos-delay="${index * 100}" data-post-url="${this.getPostUrl(post.filename)}">
                ${post.thumbnail ? `
                <div class="relative h-48 overflow-hidden">
                    <img src="${post.thumbnail}" alt="${post.title}" class="w-full h-full object-cover transition-transform duration-300 hover:scale-110">
                    <div class="absolute top-4 left-4">
                        <span class="bg-${post.category.color}-100 text-${post.category.color}-600 px-3 py-1 rounded-full text-sm font-semibold">${post.category.name}</span>
                    </div>
                    <div class="absolute top-4 right-4">
                        <span class="bg-black/50 text-white px-3 py-1 rounded-full text-sm">${this.formatDate(post.created_at)}</span>
                    </div>
                </div>
                ` : `
                <div class="p-6 pb-0">
                    <div class="flex items-center mb-4">
                        <span class="bg-${post.category.color}-100 text-${post.category.color}-600 px-3 py-1 rounded-full text-sm font-semibold">${post.category.name}</span>
                        <span class="text-gray-500 text-sm ml-auto">${this.formatDate(post.created_at)}</span>
                    </div>
                </div>
                `}
                <div class="p-6 ${post.thumbnail ? 'pt-4' : ''}">
                    <h3 class="text-xl font-bold text-gray-800 mb-3 line-clamp-2">${post.title}</h3>
                    <p class="text-gray-600 mb-4 line-clamp-3">${post.excerpt}</p>
                    <div class="flex items-center justify-between">
                        <span class="text-red-600 font-semibold">Đọc thêm</span>
                        <i class="fas fa-arrow-right text-red-600"></i>
                    </div>
                </div>
            </div>
        `);
        this.blogContainer.innerHTML = postsHTML;
        // Reinitialize AOS for new elements
        if (typeof AOS !== 'undefined') {
            AOS.refresh();
        }
        // Add click handlers for blog post cards
        this.addClickHandlers();
    }

    // Placeholder for getPostUrl and addClickHandlers if they were defined elsewhere
    // getPostUrl(filename) {
    //     return `post/${filename}`;
    // }

    // addClickHandlers() {
    //     document.querySelectorAll('.blog-post-card').forEach(card => {
    //         card.addEventListener('click', () => {
    //             const postUrl = card.dataset.postUrl;
    //             if (postUrl) {
    //                 window.location.href = postUrl;
    //             }
    //         });
    //     });
    // }

    // Placeholder for showFallbackPosts if it was defined elsewhere
    // showFallbackPosts() {
    //     this.blogContainer.innerHTML = `
    //         <div class="col-span-full text-center py-12">
    //             <i class="fas fa-exclamation-triangle text-4xl text-yellow-500 mb-4"></i>
    //             <p class="text-gray-600">Không thể tải bài đăng từ GitHub. Vui lòng thử lại sau.</p>
    //         </div>
    //     `;
    // }

    // Placeholder for formatDate if it was defined elsewhere
    // formatDate(dateString) {
    //     const date = new Date(dateString);
    //     return date.toLocaleDateString();
    // }
}

// Khởi tạo và load bài đăng khi trang web load xong
document.addEventListener('DOMContentLoaded', function() {
    const blogLoader = new BlogLoader();
    blogLoader.loadPosts();
});