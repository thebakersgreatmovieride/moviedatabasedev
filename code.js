window.addEventListener("message", (event) => {
  // 1. ALWAYS verify the origin of the sender for security
  //if (event.origin !== "https://your-iframe-domain.com") {
  //  return; 
  //}

  // 2. Access and handle the data sent by the iframe
  console.log("Message received from iframe (" + event.origin + "):", event.data);
  
  if (event.data.status === "success") {
    // Execute parent page logic here
  }
});
