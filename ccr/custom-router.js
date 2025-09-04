// custom-router.js
module.exports = async function router(req, config) {
    const userMessage = req.body.messages.find(m => m.role === 'user')?.content;

    if (userMessage && userMessage.includes('你妹')) {
        return 'webSearch_chat,webSearch_chat';
    }
    return null; // 回退到默认路由
};
