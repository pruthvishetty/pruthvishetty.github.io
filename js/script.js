window.addEventListener('DOMContentLoaded', (event) => {
  // Selecting elements
  const pronunciationIcon = document.getElementById('pronunciation-icon');
  const socialIcons = document.getElementById('social-icons');
  const fixedBg = document.getElementById('fixed-bg');
  const landing = document.getElementById('landing');
  const cityName = document.getElementById('city-name');

  const cityNames = {
    'bangalore.jpg': 'Bengaluru, India',
    'sf.jpeg': 'San Francisco, CA',
    'iisc.jpeg': 'IISc, Bengaluru, India',
    'btown.jpeg': 'Bloomington, IN',
    'indy.jpeg': 'Indianapolis, IN',
    'newport-beach.jpeg': 'Newport Beach, CA',
    'palo-alto.jpeg': 'Palo Alto, CA',
    // Add more city names here...
  };

  const images = ['bangalore.jpg', 'sf.jpeg', 'iisc.jpeg','btown.jpeg','indy.jpeg','newport-beach.jpeg','palo-alto.jpeg'];
  const randomIndex = Math.floor(Math.random() * images.length);
  const randomImage = images[randomIndex];

  // Adding social media icons with links
  const socialMedia = {
    'linkedin': 'https://www.linkedin.com/in/pruthvishetty/',
    'twitter': 'https://x.com/pruthvishetty',
    'medium': 'https://medium.com/@pruthvishetty',
    'github': 'https://github.com/pruthvishetty',
    'youtube': 'https://www.youtube.com/@pruthvi-shetty/videos',
    'instagram': 'https://www.instagram.com/pruthvishetty/',
    'email': 'mailto:mail@pruthvishetty.com'
  };

  fixedBg.style.backgroundImage = `url('assets/images/${randomImage}')`;
  fixedBg.style.filter = 'blur(8px)';
  cityName.textContent = cityNames[randomImage] || '';

  Object.entries(socialMedia).forEach(([media, link]) => {
    let icon = document.createElement('i');
    // Use 'fab' class for brand icons and 'fas' for solid icons
    icon.className = media === 'email' ? `fas fa-envelope` : `fab fa-${media}`;
  
    let anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank'; // Open the link in a new tab
    anchor.appendChild(icon);
  
    socialIcons.appendChild(anchor);
  });

  // Adding pronunciation
  pronunciationIcon.addEventListener('click', () => {
    let audio = new Audio('assets/sounds/pronunciation.mp3');
    audio.play();
  });

  // Scrolling effect for background image
  window.addEventListener('scroll', () => {
    let scrollPosition = window.scrollY;
    if (scrollPosition > landing.offsetHeight) {
      fixedBg.style.filter = 'blur(0px)';
    } else {
      let blurValue = 5 - (scrollPosition / landing.offsetHeight) * 8;
      fixedBg.style.filter = `blur(${blurValue}px)`;
    }
  });

// Dark Mode Switch
document.getElementById("darkSwitch").addEventListener("change", function() {
  if (this.checked) {
    document.documentElement.classList.add("dark-theme");
    document.documentElement.classList.remove("light-theme");
  } else {
    document.documentElement.classList.add("light-theme");
    document.documentElement.classList.remove("dark-theme");
  }
});

function updateYearProgress() {
  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const endOfYear = new Date(now.getFullYear() + 1, 0, 1);
  const totalYearMilliseconds = endOfYear - startOfYear;
  const elapsedMilliseconds = now - startOfYear;
  const percentage = (elapsedMilliseconds / totalYearMilliseconds) * 100;

  document.getElementById("year-progress").value = percentage;
  document.getElementById("year-progress-percentage").textContent = percentage.toFixed(2) + '%';
}

updateYearProgress();



});


function toggleNav() {
    const sideNav = document.getElementById("mySidenav");
    const hamburgerIcon = document.getElementById("hamburger-icon"); // Assuming you have a unique ID for the hamburger icon

    if (sideNav.style.width === "250px") {
        sideNav.style.width = "0";
        hamburgerIcon.style.display = "block"; // Show hamburger icon
    } else {
        sideNav.style.width = "250px";
        hamburgerIcon.style.display = "none"; // Hide hamburger icon
    }
}

/* Direct open and close functions if you still need them separately */
function openNav() {
    const hamburgerIcon = document.getElementById("hamburger-icon"); // Assuming you have a unique ID for the hamburger icon
    document.getElementById("mySidenav").style.width = "250px";
    hamburgerIcon.style.display = "none"; // Hide hamburger icon
}

function closeNav() {
    const hamburgerIcon = document.getElementById("hamburger-icon"); // Assuming you have a unique ID for the hamburger icon
    document.getElementById("mySidenav").style.width = "0";
    hamburgerIcon.style.display = "block"; // Show hamburger icon
}

// /* Set the width of the side navigation to 250px */
// function openNav() {
//   document.getElementById("mySidenav").style.width = "250px";
// }

// /* SetApologies for the cutoff in the previous message. The last function should read:

// ```javascript
// /* Set the width of the side navigation to 0 */
// function closeNav() {
//   document.getElementById("mySidenav").style.width = "0";
// }


/* Set the width of the side navigation to Sorry for the cutoff in the previous message. The last function should read:

```javascript
/* Set the width of the side navigation to 0 and the left margin of the page content to 0 */
function closeNav() {
  document.getElementById("mySidenav").style.width = "0";
}

const timezones = [
    { code: 'PT', offset: -7 },
    { code: 'ET', offset: -4 },
    { code: 'CT', offset: -5 },
    { code: 'IST', offset: 5.5 },
    { code: 'GMT', offset: 0 }
];

let currentZoneIndex = 0;

function updateClock() {
    const now = new Date();
    const currentOffset = timezones[currentZoneIndex].offset;
    
    // Adjust to the current timezone
    now.setHours(now.getUTCHours() + currentOffset);

    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };

    document.getElementById('date-display').textContent = now.toLocaleDateString('en-US', dateOptions);
    document.getElementById('time-display').textContent = now.toLocaleTimeString('en-US', timeOptions);
    document.getElementById('timezone-toggle').textContent = timezones[currentZoneIndex].code;
}

document.getElementById('timezone-toggle').addEventListener('click', function() {
    currentZoneIndex = (currentZoneIndex + 1) % timezones.length; // Cycle through timezones
    updateClock();
});

// Initially set the clock
updateClock();

// Update the clock every second
setInterval(updateClock, 1000);

document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
}, false);

window.onload = function() {
    var frame = document.getElementById("myIframe");
    frame.contentWindow.addEventListener('contextmenu', function(e) {
        e.preventDefault();
    }, false);
}

