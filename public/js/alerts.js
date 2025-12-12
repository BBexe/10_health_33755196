
document.addEventListener('DOMContentLoaded', function () {
    // 1. Look for the flash message element
    const flashElement = document.getElementById('flash-message');

    // 2. If it exists, read the data and fire the alert
    if (flashElement) {
        const title = flashElement.getAttribute('data-title');
        const type = flashElement.getAttribute('data-type');
        const message = flashElement.getAttribute('data-message');

        Swal.fire({
            title: title,
            text: message,
            icon: type,
            confirmButtonColor: '#3085d6',
            confirmButtonText: 'OK'
        });
    }
});