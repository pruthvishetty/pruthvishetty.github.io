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
const darkSwitch = document.getElementById('darkSwitch');
darkSwitch.checked = true; // Set dark mode as default
darkSwitch.addEventListener('change', () => {
  if (darkSwitch.checked) {
    // Use dark theme
    document.documentElement.style.setProperty('--primary-color', '#F5F5F5');
    document.documentElement.style.setProperty('--secondary-color', '#222');
    document.documentElement.style.setProperty('--bg-color', '#333');
    document.documentElement.style.setProperty('--text-color', 'white');
    document.documentElement.style.setProperty('--sidebar-color-dark', '#444');
    darkSwitch.style.backgroundColor = '#4CAF50'; // Green color when dark mode is on
  } else {
    // Use light theme
    document.documentElement.style.setProperty('--primary-color', 'white');
    document.documentElement.style.setProperty('--secondary-color', 'black');
    document.documentElement.style.setProperty('--bg-color', '#F5F5F5');
    document.documentElement.style.setProperty('--text-color', 'black');
    document.documentElement.style.setProperty('--sidebar-color-light', '#f0f0d1');
    darkSwitch.style.backgroundColor = ''; // Default color when dark mode is off
  }
});


});

/* Set the width of the side navigation to 250px */
function openNav() {
  document.getElementById("mySidenav").style.width = "250px";
}

/* SetApologies for the cutoff in the previous message. The last function should read:

```javascript
/* Set the width of the side navigation to 0 */
function closeNav() {
  document.getElementById("mySidenav").style.width = "0";
}


/* Set the width of the side navigation to Sorry for the cutoff in the previous message. The last function should read:

```javascript
/* Set the width of the side navigation to 0 and the left margin of the page content to 0 */
function closeNav() {
  document.getElementById("mySidenav").style.width = "0";
}

