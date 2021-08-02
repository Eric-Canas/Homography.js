# Homography.js
Lightweight library for performing image homographies in javascript

<table>
<thead>
  <tr>
    <th colspan="10">Image Data Warping</th>
  </tr>
</thead>
<tbody>
  <tr>
    <td></td>
    <td colspan="3" align="center"><b>400x400 &#8614; 200x200</b></td>
    <td colspan="3" align="center"><b>400x400 &#8614; 400x400</b></td>
    <td colspan="3" align="center"><b>400x400 &#8614; 800x800</b></td>
  </tr>
  <tr>
    <td><b>Transform</b></td>
    <td align="center"><i>First Frame</i></td>
    <td align="center"><i>Rest of Frames</i></td>
    <td align="center"><i>Frame Rate</i></td>
    <td align="center"><i>First Frame</i></td>
    <td align="center"><i>Rest of Frames</i></td>
    <td align="center"><i>Frame Rate</i></td>
    <td align="center"><i>First Frame</i></td>
    <td align="center"><i>Rest of Frames</i></td>
    <td align="center"><i>Frame Rate</i></td>
  </tr>
  <tr>
    <td><i>Affine</i></td>
    <td align="center">5 ms</td>
    <td align="center">0.7 ms</td>
    <td align="center">1,439 fps</td>
    <td align="center">14 ms</td>
    <td align="center">2.7 ms</td>
    <td align="center">366.7 fps</td>
    <td align="center">13 ms</td>
    <td align="center">10.8 ms</td>
    <td align="center">92.6 fps</td>
  </tr>
  <tr>
    <td><i>Projective</i></td>
    <td align="center">6 ms</td>
    <td align="center">1.9 ms</td>
    <td align="center">527.4 fps</td>
    <td align="center">21 ms</td>
    <td align="center">7.2 ms</td>
    <td align="center">139.7 fps</td>
    <td align="center">30 ms</td>
    <td align="center">27.5 ms</td>
    <td align="center">36.3 fps</td>
  </tr>
  <tr>
    <td><i>Piecewise Affine (2 Triangles)</i></td>
    <td align="center">7 ms</td>
    <td align="center">1.1 ms</td>
    <td align="center">892.9 fps</td>
    <td align="center">19 ms</td>
    <td align="center">4.4 ms</td>
    <td align="center">227.9 fps</td>
    <td align="center">40 ms</td>
    <td align="center">16.5 ms</td>
    <td align="center">60.6 fps</td>
  </tr>
  <tr>
    <td><i>Piecewise Affine (360 Tri.)</i></td>
    <td align="center">26 ms</td>
    <td align="center">2.1 ms</td>
    <td align="center">487 fps</td>
    <td align="center">21 ms</td>
    <td align="center">4.6 ms</td>
    <td align="center">216.1 fps</td>
    <td align="center">41 ms</td>
    <td align="center">22.4 ms</td>
    <td align="center">44.6 fps</td>
  </tr>
  <tr>
    <td><i>Piecewise Aff. (~23,000 Tri.)</i></td>
    <td align="center">257 ms</td>
    <td align="center">24.3 ms</td>
    <td align="center">41.17 fps</td>
    <td align="center">228 ms</td>
    <td align="center">11.5 ms</td>
    <td align="center">87.1 fps</td>
    <td align="center">28.9 ms</td>
    <td align="center">62 ms</td>
    <td align="center">16.1 fps</td>
  </tr>
  <tr>
    <td colspan="10" align="center"><b>CSS Transform Calculation</b></td>
  </tr>
  <tr>
    <td><b>Transform</b></td>
    <td colspan="3" align="center"><i>First Frame</i></td>
    <td colspan="3" align="center"><i>Rest of Frames</i></td>
    <td colspan="3" align="center"><i>Frame Rate</i></td>
  </tr>
  <tr>
    <td><i>Affine</i></td>
    <td colspan="3" align="center">4 ms</td>
    <td colspan="3" align="center">0.00014 ms</td>
    <td colspan="3" align="center">1,696,136.44 fps</td>
  </tr>
  <tr>
    <td><i>Projective</i></td>
    <td colspan="3" align="center">4 ms</td>
    <td colspan="3" align="center">0.016 ms</td>
    <td colspan="3" align="center">61,650.38 fps</td>
  </tr>
</tbody>
</table>
