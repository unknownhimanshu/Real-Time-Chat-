export function formatMessageTime(date){
    return new Date(date).toLocaleTimeString("en-US",{
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    })
}

export function getMessageStatusLabel(status){
    switch (status) {
        case "read":
            return "Read";
        case "delivered":
            return "Delivered";
        default:
            return "Sent";
    }
}
