const firstIssueMessage = (parsed) => parsed.error.issues[0].message;

module.exports = firstIssueMessage;
