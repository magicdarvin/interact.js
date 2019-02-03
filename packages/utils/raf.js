let lastTime = 0;
let request;
let cancel;
function init(window) {
    request = window.requestAnimationFrame;
    cancel = window.cancelAnimationFrame;
    if (!request) {
        const vendors = ['ms', 'moz', 'webkit', 'o'];
        for (const vendor of vendors) {
            request = window[`${vendor}RequestAnimationFrame`];
            cancel = window[`${vendor}CancelAnimationFrame`] || window[`${vendor}CancelRequestAnimationFrame`];
        }
    }
    if (!request) {
        request = (callback) => {
            const currTime = new Date().getTime();
            const timeToCall = Math.max(0, 16 - (currTime - lastTime));
            // eslint-disable-next-line standard/no-callback-literal
            const token = setTimeout(() => { callback(currTime + timeToCall); }, timeToCall);
            lastTime = currTime + timeToCall;
            return token;
        };
        cancel = (token) => clearTimeout(token);
    }
}
export default {
    request: (callback) => request(callback),
    cancel: (token) => cancel(token),
    init,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmFmLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsicmFmLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLElBQUksUUFBUSxHQUFHLENBQUMsQ0FBQTtBQUNoQixJQUFJLE9BQU8sQ0FBQTtBQUNYLElBQUksTUFBTSxDQUFBO0FBRVYsU0FBUyxJQUFJLENBQUUsTUFBTTtJQUNuQixPQUFPLEdBQUcsTUFBTSxDQUFDLHFCQUFxQixDQUFBO0lBQ3RDLE1BQU0sR0FBRyxNQUFNLENBQUMsb0JBQW9CLENBQUE7SUFFcEMsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNaLE1BQU0sT0FBTyxHQUFHLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsR0FBRyxDQUFDLENBQUE7UUFFNUMsS0FBSyxNQUFNLE1BQU0sSUFBSSxPQUFPLEVBQUU7WUFDNUIsT0FBTyxHQUFHLE1BQU0sQ0FBQyxHQUFHLE1BQU0sdUJBQXVCLENBQUMsQ0FBQTtZQUNsRCxNQUFNLEdBQUcsTUFBTSxDQUFDLEdBQUcsTUFBTSxzQkFBc0IsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxHQUFHLE1BQU0sNkJBQTZCLENBQUMsQ0FBQTtTQUNuRztLQUNGO0lBRUQsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNaLE9BQU8sR0FBRyxDQUFDLFFBQVEsRUFBRSxFQUFFO1lBQ3JCLE1BQU0sUUFBUSxHQUFHLElBQUksSUFBSSxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUE7WUFDckMsTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsRUFBRSxHQUFHLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQyxDQUFDLENBQUE7WUFDMUQsd0RBQXdEO1lBQ3hELE1BQU0sS0FBSyxHQUFHLFVBQVUsQ0FBQyxHQUFHLEVBQUUsR0FBRyxRQUFRLENBQUMsUUFBUSxHQUFHLFVBQVUsQ0FBQyxDQUFBLENBQUMsQ0FBQyxFQUNoRSxVQUFVLENBQUMsQ0FBQTtZQUViLFFBQVEsR0FBRyxRQUFRLEdBQUcsVUFBVSxDQUFBO1lBQ2hDLE9BQU8sS0FBSyxDQUFBO1FBQ2QsQ0FBQyxDQUFBO1FBRUQsTUFBTSxHQUFHLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLENBQUE7S0FDeEM7QUFDSCxDQUFDO0FBRUQsZUFBZTtJQUNiLE9BQU8sRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztJQUN4QyxNQUFNLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7SUFDaEMsSUFBSTtDQUNMLENBQUEiLCJzb3VyY2VzQ29udGVudCI6WyJsZXQgbGFzdFRpbWUgPSAwXG5sZXQgcmVxdWVzdFxubGV0IGNhbmNlbFxuXG5mdW5jdGlvbiBpbml0ICh3aW5kb3cpIHtcbiAgcmVxdWVzdCA9IHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVcbiAgY2FuY2VsID0gd2luZG93LmNhbmNlbEFuaW1hdGlvbkZyYW1lXG5cbiAgaWYgKCFyZXF1ZXN0KSB7XG4gICAgY29uc3QgdmVuZG9ycyA9IFsnbXMnLCAnbW96JywgJ3dlYmtpdCcsICdvJ11cblxuICAgIGZvciAoY29uc3QgdmVuZG9yIG9mIHZlbmRvcnMpIHtcbiAgICAgIHJlcXVlc3QgPSB3aW5kb3dbYCR7dmVuZG9yfVJlcXVlc3RBbmltYXRpb25GcmFtZWBdXG4gICAgICBjYW5jZWwgPSB3aW5kb3dbYCR7dmVuZG9yfUNhbmNlbEFuaW1hdGlvbkZyYW1lYF0gfHwgd2luZG93W2Ake3ZlbmRvcn1DYW5jZWxSZXF1ZXN0QW5pbWF0aW9uRnJhbWVgXVxuICAgIH1cbiAgfVxuXG4gIGlmICghcmVxdWVzdCkge1xuICAgIHJlcXVlc3QgPSAoY2FsbGJhY2spID0+IHtcbiAgICAgIGNvbnN0IGN1cnJUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKClcbiAgICAgIGNvbnN0IHRpbWVUb0NhbGwgPSBNYXRoLm1heCgwLCAxNiAtIChjdXJyVGltZSAtIGxhc3RUaW1lKSlcbiAgICAgIC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBzdGFuZGFyZC9uby1jYWxsYmFjay1saXRlcmFsXG4gICAgICBjb25zdCB0b2tlbiA9IHNldFRpbWVvdXQoKCkgPT4geyBjYWxsYmFjayhjdXJyVGltZSArIHRpbWVUb0NhbGwpIH0sXG4gICAgICAgIHRpbWVUb0NhbGwpXG5cbiAgICAgIGxhc3RUaW1lID0gY3VyclRpbWUgKyB0aW1lVG9DYWxsXG4gICAgICByZXR1cm4gdG9rZW5cbiAgICB9XG5cbiAgICBjYW5jZWwgPSAodG9rZW4pID0+IGNsZWFyVGltZW91dCh0b2tlbilcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCB7XG4gIHJlcXVlc3Q6IChjYWxsYmFjaykgPT4gcmVxdWVzdChjYWxsYmFjayksXG4gIGNhbmNlbDogKHRva2VuKSA9PiBjYW5jZWwodG9rZW4pLFxuICBpbml0LFxufVxuIl19